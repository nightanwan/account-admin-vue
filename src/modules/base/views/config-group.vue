<template>
	<div class="config-group">
		<el-tabs v-model="activeTab" class="config-group__tabs">
			<el-tab-pane label="系统配置" name="system">
				<tab-system ref="systemRef" />
			</el-tab-pane>
			<el-tab-pane label="安全配置" name="security">
				<tab-security ref="securityRef" />
			</el-tab-pane>
		</el-tabs>
	</div>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'sys-config-group'
});

import { ref } from 'vue';
import TabSystem from './config-group/tab-system.vue';
import TabSecurity from './config-group/tab-security.vue';

const activeTab = ref('system');
const systemRef = ref();
const securityRef = ref();
</script>

<style lang="scss" scoped>
.config-group {
	padding: 20px;
	background: var(--el-bg-color);
	border-radius: 6px;

	&__tabs {
		:deep(.el-tabs__content) {
			padding-top: 10px;
		}
	}
}
</style>
