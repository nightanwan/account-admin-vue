import axios from 'axios';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { ElMessage } from 'element-plus';
import { storage } from '/@/cool/utils';
import {
	canEncryptBody,
	interfaceEncryption,
	isEncryptionRetryMessage
} from '/@/cool/utils/encrypt';
import { useBase } from '/$/base';
import { router } from '../router';
import { config, isDev } from '/@/config';

// 创建 axios 实例
const request = axios.create({
	timeout: import.meta.env.VITE_TIMEOUT, // 设置请求超时时间
	withCredentials: false // 不携带凭证
});

// 配置 NProgress
NProgress.configure({
	showSpinner: true // 显示加载指示器
});

// 请求队列，用于存储待处理的请求
let queue: Array<(token: string) => void> = [];

// 标识是否正在刷新 token
let isRefreshing = false;

// 请求拦截器
request.interceptors.request.use(
	async (req: any) => {
		const { user } = useBase(); // 获取用户信息

		if (req.url) {
			// 控制请求进度条的显示
			if (
				!config.ignore.NProgress.some(e => req.url.match(new RegExp(`${e}.*`))) &&
				(req.NProgress ?? true)
			) {
				NProgress.start();
			}
		}

		// 在开发环境中打印请求信息
		if (isDev) {
			console.group(req.url);
			console.log('method:', req.method);
			console.table('data:', req.method == 'get' ? req.params : req.data);
			console.groupEnd();
		}

		if (!req.headers) {
			req.headers = {};
		}

		// 设置请求头中的语言
		if (req.headers['language'] !== null) {
			req.headers['language'] = config.i18n.locale;
		}

		// 验证 token
		if (user.token) {
			// 设置请求头中的 Authorization
			if (req.headers['Authorization'] !== null) {
				req.headers['Authorization'] = user.token;
			}

			// 忽略特定请求（按路径段精确匹配，避免误伤如 /steps 这种结尾包含 eps 的路径）
			if (isIgnoredAuthUrl(req.url)) {
				return prepareEncryptedRequest(req);
			}

			// 判断 token 是否过期
			if (storage.isExpired('token')) {
				// 判断 refreshToken 是否过期
				if (storage.isExpired('refreshToken')) {
					ElMessage.error('登录状态已失效，请重新登录');
					user.logout();
				} else {
					// 如果不在刷新中，则刷新 token
					if (!isRefreshing) {
						isRefreshing = true;

						user.refreshToken()
							.then(token => {
								queue.forEach(cb => cb(token)); // 处理队列中的请求
								queue = [];
								isRefreshing = false;
							})
							.catch(() => {
								isRefreshing = false;
								user.logout();
							});
					}

					// 返回一个新的 Promise，等待 token 刷新完成
					return new Promise((resolve, reject) => {
						queue.push(async token => {
							try {
								if (req.headers) {
									req.headers['Authorization'] = token; // 重新设置 token
								}
								resolve(await prepareEncryptedRequest(req));
							} catch (err) {
								reject(err);
							}
						});
					});
				}
			}
		}

		return prepareEncryptedRequest(req);
	},
	error => {
		return Promise.reject(error); // 请求错误处理
	}
);

// 响应拦截器
request.interceptors.response.use(
	async res => {
		NProgress.done(); // 结束进度条

		if (!res?.data) {
			return res;
		}

		try {
			if (res.data.encrypted) {
				res.data = await interfaceEncryption.decryptResponse(res.data);
			}
		} catch (err: any) {
			const retry = await retryWithFreshEncryption(res.config, err?.message);

			if (retry) {
				return retry;
			}

			return Promise.reject({
				message: err?.message || '接口响应解密失败'
			});
		}

		const { code, data, message } = res.data;

		if (!code) {
			return res.data; // 返回数据
		}

		switch (code) {
			case 1000:
				return data; // 成功返回数据
			default:
				return Promise.reject({ code, message }); // 处理错误
		}
	},
	async error => {
		NProgress.done(); // 结束进度条

		if (error.response) {
			const { status } = error.response;
			const message = error.response?.data?.message || error.message;
			const { user } = useBase();

			const retry = await retryWithFreshEncryption(error.config, message);

			if (retry) {
				return retry;
			}

			if (status == 401) {
				user.logout(); // 未授权，登出用户
			} else {
				if (!isDev) {
					switch (status) {
						case 403:
							router.push('/403'); // 禁止访问
							break;

						case 500:
							router.push('/500'); // 服务器错误
							break;

						case 502:
							router.push('/502'); // 网关错误
							break;
					}
				}
			}
		}

		return Promise.reject({ message: error.response?.data?.message || error.message }); // 返回错误信息
	}
);

async function prepareEncryptedRequest(req: any) {
	if (req.__skipEncrypt) {
		return req;
	}

	try {
		await interfaceEncryption.init();
	} catch (err) {
		// 握手失败时降级为明文请求，由后端最终决定是否拒绝
		console.warn('[encrypt] init failed, fallback to plain request', err);
		return req;
	}

	if (!interfaceEncryption.enabled) {
		return req;
	}

	if (!req.headers) {
		req.headers = {};
	}

	if (interfaceEncryption.shouldSendClientKey(req.url)) {
		interfaceEncryption.setClientHeader(req.headers);
	}

	if (interfaceEncryption.shouldEncryptRequestBody(req.url) && canEncryptBody(req.data)) {
		if (req.__encryptRawData === undefined) {
			req.__encryptRawData = req.data;
		}

		req.data = await interfaceEncryption.encryptBody(req.__encryptRawData);
		setRequestHeader(req.headers, 'Content-Type', 'application/json');
	}

	return req;
}

function isIgnoredAuthUrl(url?: string) {
	if (!url) {
		return false;
	}

	const path = url.split('?')[0];
	const segments = path.split('/').filter(Boolean);
	const last = segments[segments.length - 1];

	return last === 'eps' || last === 'refreshToken';
}

async function retryWithFreshEncryption(req: any, message?: string) {
	if (!req || req.__encryptRetried || !isEncryptionRetryMessage(message)) {
		return null;
	}

	req.__encryptRetried = true;

	if (req.__encryptRawData !== undefined) {
		req.data = req.__encryptRawData;
	}

	await interfaceEncryption.refresh();
	return request(req);
}

function setRequestHeader(headers: any, key: string, value: string) {
	if (typeof headers?.set === 'function') {
		headers.set(key, value);
		return;
	}

	headers[key] = value;
}

export { request };
