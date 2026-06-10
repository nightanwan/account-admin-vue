<template>
	<div class="notification-page">
		<div class="notification-page__card">
			<div class="notification-page__header">
				<h2 class="notification-page__title">消息中心</h2>
				<el-button type="primary" link @click="markAllRead" :disabled="!hasUnread">
					<el-icon class="mr-[4px]"><finished /></el-icon>
					全部标为已读
				</el-button>
			</div>

			<div class="notification-page__filters">
				<div class="notification-page__tabs">
					<div
						v-for="tab in typeTabs"
						:key="tab.value"
						class="notification-page__tab-item"
						:class="{ 'is-active': activeType === tab.value }"
						@click="switchType(tab.value)"
					>
						{{ tab.label }}
						<span v-if="tab.count" class="notification-page__tab-count">
							{{ tab.count }}
						</span>
					</div>
				</div>

				<div class="notification-page__status-filter">
					<el-radio-group v-model="readFilter" size="small" @change="onFilterChange">
						<el-radio-button :value="-1">全部</el-radio-button>
						<el-radio-button :value="0">未读</el-radio-button>
						<el-radio-button :value="1">已读</el-radio-button>
					</el-radio-group>
				</div>
			</div>

			<div class="notification-page__list" v-loading="loading">
				<template v-if="list.length">
					<div
						v-for="item in list"
						:key="item.id"
						class="notif-card"
						:class="{ 'is-unread': !item.isRead }"
					>
						<div class="notif-card__indicator" v-if="!item.isRead" />

						<div class="notif-card__body" @click="toggleExpand(item)">
							<div class="notif-card__top">
								<div class="notif-card__meta">
									<el-tag
										:type="getTypeInfo(item.type).tagType"
										size="small"
										effect="plain"
										round
									>
										{{ getTypeInfo(item.type).label }}
									</el-tag>
									<span class="notif-card__title">{{ item.title }}</span>
								</div>
								<span class="notif-card__date">
									{{ formatFullDate(item.sendTime) }}
								</span>
							</div>

							<div
								class="notif-card__content"
								:class="{ 'is-expanded': item._expanded }"
							>
								{{ item.content }}
							</div>

							<div class="notif-card__actions" v-if="!item.isRead">
								<el-button
									type="primary"
									link
									size="small"
									@click.stop="markRead(item)"
								>
									标为已读
								</el-button>
							</div>
						</div>
					</div>
				</template>
				<div v-else-if="!loading" class="notification-page__empty">
					<el-icon :size="60" color="var(--el-text-color-placeholder)">
						<bell-filled />
					</el-icon>
					<p>暂无消息</p>
				</div>
			</div>

			<div class="notification-page__pagination" v-if="pagination.total > pagination.size">
				<el-pagination
					v-model:current-page="pagination.page"
					:page-size="pagination.size"
					:total="pagination.total"
					layout="prev, pager, next"
					background
					@current-change="onPageChange"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'notification-page' });

import { ref, reactive, onMounted, computed } from 'vue';
import { BellFilled, Finished } from '@element-plus/icons-vue';
import { useCool } from '/@/cool';
import { ElMessage } from 'element-plus';

const { service } = useCool();

const typeMap: Record<
	number,
	{ label: string; tagType: 'primary' | 'warning' | 'danger' | 'success' }
> = {
	0: { label: '通知', tagType: 'primary' },
	1: { label: '提醒', tagType: 'warning' },
	2: { label: '紧急', tagType: 'danger' },
	3: { label: '更新', tagType: 'success' }
};

function getTypeInfo(type: number) {
	return typeMap[type] || typeMap[0];
}

function formatFullDate(dateStr: string) {
	if (!dateStr) return '';
	const d = new Date(dateStr);
	const now = new Date();
	const isThisYear = d.getFullYear() === now.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hour = String(d.getHours()).padStart(2, '0');
	const min = String(d.getMinutes()).padStart(2, '0');

	if (d.toDateString() === now.toDateString()) return `今天 ${hour}:${min}`;
	if (isThisYear) return `${month}-${day} ${hour}:${min}`;
	return `${d.getFullYear()}-${month}-${day} ${hour}:${min}`;
}

const typeTabs = ref([
	{ label: '全部', value: -1, count: 0 },
	{ label: '通知', value: 0, count: 0 },
	{ label: '提醒', value: 1, count: 0 },
	{ label: '紧急', value: 2, count: 0 },
	{ label: '系统更新', value: 3, count: 0 }
]);

const activeType = ref(-1);
const readFilter = ref(-1);
const list = ref<any[]>([]);
const loading = ref(false);
const pagination = reactive({ page: 1, size: 15, total: 0 });

const hasUnread = computed(() => list.value.some(item => !item.isRead));

async function fetchList() {
	loading.value = true;
	try {
		const params: any = {
			page: pagination.page,
			size: pagination.size
		};
		if (activeType.value >= 0) params.type = activeType.value;
		if (readFilter.value >= 0) params.isRead = readFilter.value;

		const res = await service.base.comm.noticePage(params);
		list.value = (res?.list || res || []).map((item: any) => ({
			...item,
			_expanded: false
		}));
		if (res?.pagination) {
			pagination.total = res.pagination.total || 0;
		}
	} catch {
		// ignore
	} finally {
		loading.value = false;
	}
}

async function markRead(item: any) {
	try {
		await service.base.comm.markRead({ notificationId: item.id });
		item.isRead = 1;
		ElMessage.success('已标为已读');
	} catch {
		// ignore
	}
}

async function markAllRead() {
	const unreadItems = list.value.filter(item => !item.isRead);
	if (!unreadItems.length) return;

	try {
		await Promise.all(
			unreadItems.map(item => service.base.comm.markRead({ notificationId: item.id }))
		);
		unreadItems.forEach(item => (item.isRead = 1));
		ElMessage.success('已全部标为已读');
	} catch {
		// ignore
	}
}

function toggleExpand(item: any) {
	item._expanded = !item._expanded;
}

function switchType(type: number) {
	activeType.value = type;
	pagination.page = 1;
	fetchList();
}

function onFilterChange() {
	pagination.page = 1;
	fetchList();
}

function onPageChange(page: number) {
	pagination.page = page;
	fetchList();
}

onMounted(() => {
	fetchList();
});
</script>

<style lang="scss" scoped>
.notification-page {
	padding: 20px;

	&__card {
		background: var(--el-bg-color);
		border-radius: 12px;
		padding: 28px 32px;
		min-height: calc(100vh - 130px);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	&__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	&__title {
		font-size: 20px;
		font-weight: 600;
		color: var(--el-text-color-primary);
		margin: 0;
	}

	&__filters {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--el-border-color-lighter);
	}

	&__tabs {
		display: flex;
		gap: 4px;
	}

	&__tab-item {
		display: inline-flex;
		align-items: center;
		padding: 6px 16px;
		border-radius: 20px;
		font-size: 13px;
		color: var(--el-text-color-secondary);
		cursor: pointer;
		transition: all 0.2s;
		font-weight: 500;

		&:hover {
			background: var(--el-fill-color-light);
			color: var(--el-text-color-primary);
		}

		&.is-active {
			background: var(--el-color-primary-light-9);
			color: var(--el-color-primary);
		}
	}

	&__tab-count {
		font-size: 11px;
		background: var(--el-fill-color);
		padding: 1px 6px;
		border-radius: 10px;
		margin-left: 4px;
		min-width: 18px;
		text-align: center;
	}

	&__list {
		min-height: 300px;
	}

	&__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 0;
		color: var(--el-text-color-placeholder);
		font-size: 14px;

		p {
			margin-top: 12px;
		}
	}

	&__pagination {
		display: flex;
		justify-content: center;
		padding-top: 24px;
	}
}

.notif-card {
	position: relative;
	display: flex;
	align-items: flex-start;
	padding: 18px 20px;
	margin-bottom: 8px;
	border-radius: 10px;
	border: 1px solid var(--el-border-color-extra-light);
	transition: all 0.2s;
	cursor: pointer;

	&:hover {
		border-color: var(--el-border-color-light);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
	}

	&.is-unread {
		background: var(--el-color-primary-light-9);
		border-color: var(--el-color-primary-light-8);

		&:hover {
			border-color: var(--el-color-primary-light-7);
		}
	}

	&__indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--el-color-primary);
		flex-shrink: 0;
		margin-top: 8px;
		margin-right: 12px;
	}

	&__body {
		flex: 1;
		min-width: 0;
	}

	&__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	&__meta {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}

	&__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--el-text-color-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__date {
		font-size: 12px;
		color: var(--el-text-color-placeholder);
		white-space: nowrap;
		margin-left: 12px;
		flex-shrink: 0;
	}

	&__content {
		font-size: 13px;
		color: var(--el-text-color-secondary);
		line-height: 1.6;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		&.is-expanded {
			white-space: normal;
			word-break: break-all;
		}
	}

	&__actions {
		margin-top: 8px;
		display: flex;
		justify-content: flex-end;
	}
}
</style>
