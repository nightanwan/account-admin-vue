import axios from 'axios';
import { config } from '/@/config';

const ENCRYPTION_VERSION = 1;
const ENCRYPTION_ALGORITHM = 'ECDH-P256-AES-256-GCM';
const GCM_TAG_BYTES = 16;
const NONCE_BYTES = 16;
const PUBLIC_KEY_URL = '/admin/base/sys/encrypt/publicKey';
const CLIENT_PUBLIC_KEY_HEADER = 'X-Encrypt-Client-Key';

type EncryptContext = 'request' | 'response';

/**
 * 客户端启动安全配置
 * 仅包含建立加密会话和前端安全开关所需的字段，所有"是否加密"的策略由后端权威判定
 */
export interface HandshakeConfig {
	enabled: boolean;
	algorithm: string;
	keyId: string;
	serverPublicKey: string;
	disableDevtool: boolean;
}

export interface EncryptEnvelope {
	encrypted: true;
	v: typeof ENCRYPTION_VERSION;
	alg: typeof ENCRYPTION_ALGORITHM;
	kid: string;
	data: string;
	iv: string;
	salt: string;
	tag: string;
	clientPublicKey?: string;
	ts?: number;
	nonce?: string;
}

export interface EncryptRequestOptions {
	method?: string;
	url?: string;
}

export class InterfaceEncryptionClient {
	private security?: HandshakeConfig;
	private clientKeys?: CryptoKeyPair;
	private serverPublicKey?: CryptoKey;
	private clientPublicKeyBase64 = '';
	private initPromise?: Promise<HandshakeConfig>;
	private encoder = new TextEncoder();
	private decoder = new TextDecoder();

	get enabled() {
		return Boolean(this.security?.enabled && this.clientKeys && this.serverPublicKey);
	}

	get clientPublicKeyHeader() {
		return this.clientPublicKeyBase64;
	}

	async init(force = false) {
		if (this.security && !force) {
			return this.security;
		}

		if (!this.initPromise || force) {
			this.initPromise = this.loadConfig().catch(err => {
				// 加载/握手失败时清掉所有状态，避免半初始化的 security 让下次 init 直接命中早返回
				this.clear();
				throw err;
			});
		}

		try {
			return await this.initPromise;
		} finally {
			this.initPromise = undefined;
		}
	}

	async refresh() {
		this.clear();
		return this.init(true);
	}

	clear() {
		this.security = undefined;
		this.clientKeys = undefined;
		this.serverPublicKey = undefined;
		this.clientPublicKeyBase64 = '';
		this.initPromise = undefined;
	}

	/**
	 * 是否要对该 URL 进行加密相关处理
	 * 策略：加密开启 + 命中后台/应用接口前缀即可，具体是否加密由后端权威判定
	 */
	shouldHandleUrl(rawUrl?: string) {
		if (!this.enabled) {
			return false;
		}

		const url = normalizeUrl(rawUrl);

		if (!url) {
			return false;
		}

		return url.startsWith('/admin/') || url.startsWith('/app/');
	}

	shouldSendClientKey(rawUrl?: string) {
		return this.shouldHandleUrl(rawUrl);
	}

	shouldEncryptRequestBody(rawUrl?: string) {
		return this.shouldHandleUrl(rawUrl);
	}

	setClientHeader(headers: any) {
		if (!this.enabled || !this.clientPublicKeyBase64) {
			return;
		}

		setHeader(headers, CLIENT_PUBLIC_KEY_HEADER, this.clientPublicKeyBase64);
	}

	async encryptBody(data: any, options: EncryptRequestOptions = {}): Promise<EncryptEnvelope | any> {
		if (!this.enabled) {
			return data;
		}

		const security = this.assertReady();
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const ts = Date.now();
		const nonce = bytesToBase64(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
		const key = await this.derivePayloadKey(salt, 'request');
		const plaintext = this.encoder.encode(JSON.stringify(data ?? {}));
		const encrypted = new Uint8Array(
			await crypto.subtle.encrypt(
				{
					name: 'AES-GCM',
					iv: toArrayBuffer(iv),
					additionalData: this.createAAD('request', {
						method: options.method,
						url: options.url,
						ts,
						nonce
					}),
					tagLength: 128
				},
				key,
				toArrayBuffer(plaintext)
			)
		);
		const ciphertext = encrypted.slice(0, encrypted.length - GCM_TAG_BYTES);
		const tag = encrypted.slice(encrypted.length - GCM_TAG_BYTES);

		return {
			encrypted: true,
			v: ENCRYPTION_VERSION,
			alg: ENCRYPTION_ALGORITHM,
			kid: security.keyId,
			clientPublicKey: this.clientPublicKeyBase64,
			data: bytesToBase64(ciphertext),
			iv: bytesToBase64(iv),
			salt: bytesToBase64(salt),
			tag: bytesToBase64(tag),
			ts,
			nonce
		};
	}

	async decryptResponse<T = any>(body: any): Promise<T> {
		if (!body?.encrypted) {
			return body;
		}

		const security = this.assertReady();

		if (
			body.v !== ENCRYPTION_VERSION ||
			body.alg !== ENCRYPTION_ALGORITHM ||
			body.kid !== security.keyId
		) {
			throw new Error('接口加密密钥已过期');
		}

		const iv = base64ToBytes(body.iv);
		const salt = base64ToBytes(body.salt);
		const ciphertext = base64ToBytes(body.data);
		const tag = base64ToBytes(body.tag);
		const key = await this.derivePayloadKey(salt, 'response');
		const encrypted = concatBytes(ciphertext, tag);
		const plaintext = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: toArrayBuffer(iv),
				additionalData: this.createAAD('response'),
				tagLength: 128
			},
			key,
			toArrayBuffer(encrypted)
		);
		const {
			encrypted: _encrypted,
			v: _v,
			alg: _alg,
			kid: _kid,
			iv: _iv,
			salt: _salt,
			tag: _tag,
			data: _data,
			...rest
		} = body;

		return {
			...rest,
			data: JSON.parse(this.decoder.decode(plaintext))
		};
	}

	private async loadConfig() {
		const res = await axios.post(
			withBaseUrl(PUBLIC_KEY_URL),
			{},
			{
				withCredentials: false,
				headers: {
					language: config.i18n.locale
				}
			}
		);
		const security = normalizeSecurityConfig(res.data?.data || res.data);

		if (!security.enabled) {
			this.security = security;
			this.clientKeys = undefined;
			this.serverPublicKey = undefined;
			this.clientPublicKeyBase64 = '';
			return security;
		}

		if (
			security.algorithm !== ENCRYPTION_ALGORITHM ||
			!security.keyId ||
			!security.serverPublicKey
		) {
			throw new Error('接口加密配置不完整');
		}

		// 全部 await 完成后再原子赋值，任一步骤失败都不会留下半初始化状态
		// 同时避免并发 refresh 时不同 promise 交错写入相互覆盖
		const serverPublicKey = await crypto.subtle.importKey(
			'raw',
			toArrayBuffer(base64ToBytes(security.serverPublicKey)),
			{
				name: 'ECDH',
				namedCurve: 'P-256'
			},
			false,
			[]
		);
		const clientKeys = await crypto.subtle.generateKey(
			{
				name: 'ECDH',
				namedCurve: 'P-256'
			},
			true,
			['deriveBits']
		);
		const rawPublicKey = await crypto.subtle.exportKey('raw', clientKeys.publicKey);
		const clientPublicKeyBase64 = bytesToBase64(new Uint8Array(rawPublicKey));

		this.security = security;
		this.serverPublicKey = serverPublicKey;
		this.clientKeys = clientKeys;
		this.clientPublicKeyBase64 = clientPublicKeyBase64;

		return security;
	}

	private assertReady() {
		if (!this.security || !this.clientKeys || !this.serverPublicKey) {
			throw new Error('接口加密客户端未初始化');
		}

		return this.security;
	}

	private async derivePayloadKey(salt: Uint8Array, context: EncryptContext) {
		const security = this.assertReady();
		const clientKeys = this.clientKeys!;
		const serverPublicKey = this.serverPublicKey!;
		const sharedSecret = await crypto.subtle.deriveBits(
			{
				name: 'ECDH',
				public: serverPublicKey
			},
			clientKeys.privateKey,
			256
		);
		const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
			'deriveKey'
		]);

		return crypto.subtle.deriveKey(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: toArrayBuffer(salt),
				info: toArrayBuffer(
					this.encoder.encode(`${ENCRYPTION_ALGORITHM}:${security.keyId}:${context}`)
				)
			},
			hkdfKey,
			{
				name: 'AES-GCM',
				length: 256
			},
			false,
			['encrypt', 'decrypt']
		);
	}

	private createAAD(
		context: EncryptContext,
		requestOptions?: EncryptRequestOptions & { ts?: number; nonce?: string }
	) {
		const security = this.assertReady();
		const base = `${ENCRYPTION_ALGORITHM}:${ENCRYPTION_VERSION}:${security.keyId}:${context}`;

		if (context !== 'request') {
			return toArrayBuffer(this.encoder.encode(base));
		}

		return toArrayBuffer(
			this.encoder.encode(
				[
					base,
					normalizeMethod(requestOptions?.method),
					normalizeUrl(requestOptions?.url),
					String(requestOptions?.ts),
					requestOptions?.nonce
				].join(':')
			)
		);
	}
}

export const interfaceEncryption = new InterfaceEncryptionClient();

export function canEncryptBody(data: any) {
	if (!data || typeof data !== 'object' || data.encrypted === true) {
		return false;
	}

	if (typeof FormData !== 'undefined' && data instanceof FormData) {
		return false;
	}

	if (typeof Blob !== 'undefined' && data instanceof Blob) {
		return false;
	}

	if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
		return false;
	}

	if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
		return false;
	}

	return true;
}

export function isEncryptionRetryMessage(message?: string) {
	return Boolean(
		message &&
			/请求解密失败|加密配置|加密密钥|要求加密请求|要求加密响应|key expired/i.test(message)
	);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

function normalizeSecurityConfig(value: any): HandshakeConfig {
	return {
		enabled: Boolean(value?.enabled),
		algorithm: value?.algorithm || ENCRYPTION_ALGORITHM,
		keyId: value?.keyId || '',
		serverPublicKey: value?.serverPublicKey || '',
		disableDevtool: Boolean(value?.disableDevtool)
	};
}

function withBaseUrl(url: string) {
	const baseUrl = config.baseUrl || '';

	if (!baseUrl || baseUrl === '/') {
		return url;
	}

	return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function normalizeUrl(rawUrl?: string) {
	if (!rawUrl) {
		return '';
	}

	let pathname = rawUrl.split('?')[0];

	try {
		pathname = new URL(rawUrl, location.origin).pathname;
	} catch {
		// Keep the raw path when URL parsing is not possible.
	}

	const baseUrl = config.baseUrl;

	if (baseUrl && baseUrl !== '/' && !/^https?:\/\//i.test(baseUrl)) {
		const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

		if (pathname === normalizedBaseUrl) {
			pathname = '/';
		} else if (pathname.startsWith(`${normalizedBaseUrl}/`)) {
			pathname = pathname.substring(normalizedBaseUrl.length);
		}
	}

	return pathname || '/';
}

function normalizeMethod(method?: string) {
	return String(method || 'GET').toUpperCase();
}

function setHeader(headers: any, key: string, value: string) {
	if (typeof headers?.set === 'function') {
		headers.set(key, value);
		return;
	}

	headers[key] = value;
}

function base64ToBytes(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = '';
	const chunkSize = 0x8000;

	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
	}

	return btoa(binary);
}

function concatBytes(first: Uint8Array, second: Uint8Array) {
	const result = new Uint8Array(first.length + second.length);
	result.set(first);
	result.set(second, first.length);
	return result;
}
