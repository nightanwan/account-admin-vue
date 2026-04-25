<template>
	<div class="tab-system">
		<div class="tab-system__header">
			<el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
			<el-button @click="handleRefresh">刷新</el-button>
		</div>

		<el-divider />

		<el-form :model="form" label-width="100px" class="tab-system__form">
			<el-form-item label="站点名称">
				<el-input v-model="form.siteName" placeholder="请输入站点名称" />
			</el-form-item>

			<el-form-item label="站点描述">
				<el-input
					v-model="form.siteDescription"
					type="textarea"
					:rows="2"
					placeholder="请输入站点描述"
				/>
			</el-form-item>

			<el-form-item label="站点Logo">
				<el-input v-model="form.siteLogo" placeholder="请输入Logo URL" />
			</el-form-item>

			<el-form-item label="版权信息">
				<el-input v-model="form.copyright" placeholder="请输入版权信息" />
			</el-form-item>

			<el-form-item label="启用水印">
				<el-switch v-model="form.watermarkEnabled" />
			</el-form-item>

			<el-form-item label="水印内容" v-if="form.watermarkEnabled">
				<el-select
					v-model="form.watermarkType"
					placeholder="选择水印内容"
					style="width: 200px"
				>
					<el-option label="昵称" value="nickname" />
					<el-option label="昵称+时间" value="nickname_time" />
					<el-option label="站点名称" value="site_name" />
					<el-option label="自定义文本" value="custom" />
				</el-select>
			</el-form-item>

			<el-form-item
				label="自定义文本"
				v-if="form.watermarkEnabled && form.watermarkType === 'custom'"
			>
				<el-input v-model="form.watermarkCustomText" placeholder="请输入自定义水印文本" />
			</el-form-item>

			<el-form-item label="水印透明度" v-if="form.watermarkEnabled">
				<el-slider
					v-model="form.watermarkOpacity"
					:min="0"
					:max="100"
					:step="1"
					show-input
				/>
			</el-form-item>
		</el-form>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useCool } from '/@/cool';

const GROUP_CODE = 'system';

const { service } = useCool();

const saving = ref(false);

const form = ref({
	siteName: '',
	siteDescription: '',
	siteLogo: '',
	copyright: '',
	watermarkEnabled: false,
	watermarkType: 'nickname' as 'nickname' | 'nickname_time' | 'site_name' | 'custom',
	watermarkCustomText: '',
	watermarkOpacity: 15
});

async function loadConfig() {
	try {
		const res = await service.base.comm.request({
			url: '/getConfig',
			method: 'POST',
			data: { groupCode: GROUP_CODE },
			__skipEncrypt: true
		});
		if (res) {
			form.value = {
				siteName: res.siteName ?? '',
				siteDescription: res.siteDescription ?? '',
				siteLogo: res.siteLogo ?? '',
				copyright: res.copyright ?? '',
				watermarkEnabled: res.watermarkEnabled ?? false,
				watermarkType: res.watermarkType ?? 'nickname',
				watermarkCustomText: res.watermarkCustomText ?? '',
				watermarkOpacity: res.watermarkOpacity ?? 15
			};
		}
	} catch (err: any) {
		console.error('加载系统配置失败', err);
	}
}

async function handleSave() {
	saving.value = true;
	try {
		await service.base.sys.configGroup.request({
			url: '/updateConfig',
			method: 'POST',
			data: {
				groupCode: GROUP_CODE,
				groupName: '系统配置',
				configValue: { ...form.value }
			},
			__skipEncrypt: true
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

onMounted(() => {
	loadConfig();
});
</script>

<style lang="scss" scoped>
.tab-system {
	&__header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	&__form {
		max-width: 800px;
	}
}
</style>
