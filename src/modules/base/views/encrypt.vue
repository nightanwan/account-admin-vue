<template>
	<div class="encrypt-config">
		<div class="encrypt-config__header">
			<el-button type="primary" @click="handleSave" :loading="saving">
				保存配置
			</el-button>
			<el-button @click="handleRefresh">刷新缓存</el-button>
		</div>

		<el-divider />

		<el-form :model="form" label-width="100px" class="encrypt-config__form">
			<!-- 接口加密开关 -->
			<el-form-item label="接口加密">
				<el-switch v-model="form.enabled" />
			</el-form-item>

			<!-- 加密范围 -->
			<el-form-item label="加密范围">
				<el-radio-group v-model="form.scope">
					<el-radio value="partial">
						部分加密
						<span class="encrypt-config__hint">
							（仅加密带 @EncryptResponse 注解的接口）
						</span>
					</el-radio>
					<el-radio value="global">
						全局加密
						<span class="encrypt-config__hint">
							（所有接口返回都加密）
						</span>
					</el-radio>
				</el-radio-group>
			</el-form-item>

			<!-- RSA 公钥 -->
			<el-form-item label="RSA公钥">
				<el-input
					v-model="form.rsaPublicKey"
					type="textarea"
					:rows="5"
					readonly
					placeholder="请先生成密钥"
				/>
			</el-form-item>

			<!-- RSA 私钥 -->
			<el-form-item label="RSA私钥">
				<el-input
					v-model="form.rsaPrivateKey"
					type="textarea"
					:rows="5"
					readonly
					placeholder="请先生成密钥"
				/>
			</el-form-item>

			<!-- 生成密钥 -->
			<el-form-item label="生成密钥">
				<el-button type="primary" @click="handleGenerateKeys" :loading="generating">
					{{ form.rsaPublicKey ? '重新生成密钥' : '生成密钥' }}
				</el-button>
			</el-form-item>
		</el-form>
	</div>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'sys-encrypt'
});

import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useCool } from '/@/cool';

const { service } = useCool();

const form = ref({
	enabled: false,
	scope: 'global' as 'global' | 'partial',
	rsaPublicKey: '',
	rsaPrivateKey: ''
});

const saving = ref(false);
const generating = ref(false);

async function loadConfig() {
	try {
		const res = await service.base.sys.encrypt.getConfig();
		if (res) {
			form.value = {
				enabled: res.enabled ?? false,
				scope: res.scope ?? 'global',
				rsaPublicKey: res.rsaPublicKey ?? '',
				rsaPrivateKey: res.rsaPrivateKey ?? ''
			};
		}
	} catch (err: any) {
		console.error('加载配置失败', err);
	}
}

async function handleSave() {
	if (form.value.enabled && !form.value.rsaPublicKey) {
		ElMessage.warning('请先生成RSA密钥');
		return;
	}
	saving.value = true;
	try {
		await service.base.sys.encrypt.updateConfig({
			enabled: form.value.enabled,
			scope: form.value.scope
		});
		ElMessage.success('保存成功');
	} catch (err: any) {
		ElMessage.error(err.message || '保存失败');
	} finally {
		saving.value = false;
	}
}

async function handleRefresh() {
	await loadConfig();
	ElMessage.success('刷新成功');
}

async function handleGenerateKeys() {
	if (form.value.rsaPublicKey) {
		try {
			await ElMessageBox.confirm(
				'重新生成密钥后，已登录的用户需要重新登录才能正常使用。确定要重新生成？',
				'提示',
				{ type: 'warning' }
			);
		} catch {
			return;
		}
	}
	generating.value = true;
	try {
		const res = await service.base.sys.encrypt.generateKeys();
		form.value.rsaPublicKey = res.rsaPublicKey;
		form.value.rsaPrivateKey = res.rsaPrivateKey;
		ElMessage.success('密钥生成成功');
	} catch (err: any) {
		ElMessage.error(err.message || '密钥生成失败');
	} finally {
		generating.value = false;
	}
}

onMounted(() => {
	loadConfig();
});
</script>

<style lang="scss" scoped>
.encrypt-config {
	padding: 20px;
	background: var(--el-bg-color);
	border-radius: 6px;

	&__header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	&__form {
		max-width: 800px;

		:deep(.el-radio-group) {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}
	}

	&__hint {
		color: var(--el-text-color-placeholder);
		font-size: 12px;
		margin-left: 4px;
	}
}
</style>
