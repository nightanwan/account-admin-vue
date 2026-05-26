<template>
	<div class="tab-security">
		<div class="tab-security__header">
			<el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
			<el-button @click="handleRefresh">刷新缓存</el-button>
		</div>

		<el-divider />

		<el-form :model="form" label-width="120px" class="tab-security__form">
			<el-form-item label="接口加密">
				<el-switch v-model="form.enabled" />
			</el-form-item>

			<el-form-item label="加密范围">
				<el-radio-group v-model="form.scope">
					<el-radio value="partial">
						部分加密
						<span class="tab-security__hint"
							>（仅加密带 @EncryptResponse 注解或指定路径的接口）</span
						>
					</el-radio>
					<el-radio value="global">
						全局加密
						<span class="tab-security__hint">（后台和应用接口返回都加密）</span>
					</el-radio>
				</el-radio-group>
			</el-form-item>

			<el-form-item label="强制请求加密">
				<el-switch v-model="form.requestRequired" />
				<span class="tab-security__hint"
					>开启后，加密接口的请求若未加密会被拒绝；前端始终尽力加密，此开关只控制后端是否强制校验</span
				>
			</el-form-item>

			<el-form-item label="强制响应加密">
				<el-switch v-model="form.responseRequired" />
				<span class="tab-security__hint"
					>关闭后，即使接口在加密范围内，响应也会以明文返回</span
				>
			</el-form-item>

			<el-form-item label="禁止前端调试">
				<el-switch v-model="form.disableDevtool" />
				<span class="tab-security__hint"
					>开启后前端会阻止 F12、右键菜单和常见开发者工具调试，仅用于提高查看门槛；关闭后刷新页面生效</span
				>
			</el-form-item>

			<el-form-item label="协议算法">
				<el-input v-model="form.algorithm" readonly />
			</el-form-item>

			<el-form-item label="密钥标识">
				<el-input v-model="form.keyId" readonly placeholder="保存或生成密钥后自动生成" />
			</el-form-item>

			<el-form-item label="服务端公钥">
				<el-input
					v-model="form.serverPublicKey"
					type="textarea"
					:rows="5"
					readonly
					placeholder="保存或生成密钥后自动生成"
				/>
			</el-form-item>

			<el-form-item label="服务端私钥">
				<el-tag :type="form.hasServerPrivateKey ? 'success' : 'warning'">
					{{ form.hasServerPrivateKey ? '已生成' : '未生成' }}
				</el-tag>
				<span class="tab-security__hint">私钥仅保存在服务端，不再返回前端</span>
			</el-form-item>

			<el-form-item label="加密路径">
				<el-input
					v-model="form.includeUrls"
					type="textarea"
					:rows="4"
					placeholder="/admin/demo/goods/info"
				/>
			</el-form-item>

			<el-form-item label="排除路径">
				<el-input
					v-model="form.excludeUrls"
					type="textarea"
					:rows="4"
					placeholder="/admin/base/comm/upload"
				/>
			</el-form-item>

			<el-form-item label="请求明文路径">
				<el-input
					v-model="form.requestExcludeUrls"
					type="textarea"
					:rows="4"
					placeholder="/admin/dingtalk/callback"
				/>
				<span class="tab-security__hint">这些接口不强制请求体加密，适合第三方平台回调</span>
			</el-form-item>

			<el-form-item label="响应明文路径">
				<el-input
					v-model="form.responseExcludeUrls"
					type="textarea"
					:rows="4"
					placeholder="/admin/dingtalk/callback"
				/>
				<span class="tab-security__hint">这些接口响应保持明文，适合需要固定响应格式的第三方回调</span>
			</el-form-item>

			<el-form-item label="生成密钥">
				<el-button type="primary" @click="handleGenerateKeys" :loading="generating">
					{{ form.keyId ? '重新生成密钥' : '生成密钥' }}
				</el-button>
			</el-form-item>
		</el-form>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useCool } from '/@/cool';
import { applyDevtoolProtection } from '/@/cool/utils/devtool';
import { interfaceEncryption } from '/@/cool/utils/encrypt';

const { service } = useCool();

const form = ref({
	enabled: true,
	scope: 'global' as 'global' | 'partial',
	requestRequired: true,
	responseRequired: true,
	disableDevtool: false,
	algorithm: 'ECDH-P256-AES-256-GCM',
	keyId: '',
	serverPublicKey: '',
	hasServerPrivateKey: false,
	includeUrls: '',
	excludeUrls: '',
	requestExcludeUrls: '',
	responseExcludeUrls: ''
});

const saving = ref(false);
const generating = ref(false);

function setForm(res: any) {
	form.value = {
		enabled: res?.enabled ?? true,
		scope: res?.scope ?? 'global',
		requestRequired: res?.requestRequired ?? true,
		responseRequired: res?.responseRequired ?? true,
		disableDevtool: res?.disableDevtool ?? false,
		algorithm: res?.algorithm ?? 'ECDH-P256-AES-256-GCM',
		keyId: res?.keyId ?? '',
		serverPublicKey: res?.serverPublicKey ?? '',
		hasServerPrivateKey: res?.hasServerPrivateKey ?? false,
		includeUrls: formatUrls(res?.includeUrls),
		excludeUrls: formatUrls(res?.excludeUrls),
		requestExcludeUrls: formatUrls(res?.requestExcludeUrls),
		responseExcludeUrls: formatUrls(res?.responseExcludeUrls)
	};
}

function formatUrls(urls?: string[]) {
	return Array.isArray(urls) ? urls.join('\n') : '';
}

function parseUrls(value: string) {
	return value
		.split('\n')
		.map(e => e.trim())
		.filter(Boolean);
}

async function loadConfig() {
	try {
		const res = await encryptConfigRequest('/getConfig');
		if (res) {
			setForm(res);
		}
	} catch (err: any) {
		console.error('加载配置失败', err);
	}
}

async function handleSave() {
	saving.value = true;
	try {
		const res = await encryptConfigRequest('/updateConfig', {
			enabled: form.value.enabled,
			scope: form.value.scope,
			requestRequired: form.value.requestRequired,
			responseRequired: form.value.responseRequired,
			disableDevtool: form.value.disableDevtool,
			includeUrls: parseUrls(form.value.includeUrls),
			excludeUrls: parseUrls(form.value.excludeUrls),
			requestExcludeUrls: parseUrls(form.value.requestExcludeUrls),
			responseExcludeUrls: parseUrls(form.value.responseExcludeUrls)
		});
		setForm(res);
		await interfaceEncryption.refresh();
		await applyDevtoolProtection(res?.disableDevtool);
		ElMessage.success('保存成功');
	} catch (err: any) {
		ElMessage.error(err.message || '保存失败');
	} finally {
		saving.value = false;
	}
}

async function handleRefresh() {
	await loadConfig();
	await interfaceEncryption.refresh();
	ElMessage.success('刷新成功');
}

async function handleGenerateKeys() {
	if (form.value.keyId) {
		try {
			await ElMessageBox.confirm(
				'重新生成密钥后，已打开页面会重新获取公钥，正在发送的请求可能需要重试。确定要重新生成？',
				'提示',
				{ type: 'warning' }
			);
		} catch {
			return;
		}
	}
	generating.value = true;
	try {
		const res = await encryptConfigRequest('/generateKeys');
		setForm(res);
		await interfaceEncryption.refresh();
		ElMessage.success('密钥生成成功');
	} catch (err: any) {
		ElMessage.error(err.message || '密钥生成失败');
	} finally {
		generating.value = false;
	}
}

function encryptConfigRequest(url: string, data?: any) {
	return service.base.sys.encrypt.request({
		url,
		method: 'POST',
		data,
		__skipEncrypt: true
	});
}

onMounted(() => {
	loadConfig();
});
</script>

<style lang="scss" scoped>
.tab-security {
	&__header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	&__form {
		max-width: 860px;

		:deep(.el-radio-group) {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
	}

	&__hint {
		color: var(--el-text-color-placeholder);
		font-size: 12px;
		margin-left: 8px;
	}
}
</style>
