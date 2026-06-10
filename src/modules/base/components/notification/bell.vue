<template>
	<el-popover
		placement="bottom-end"
		:width="380"
		trigger="click"
		:show-arrow="false"
		popper-class="notification-bell-popover"
		@show="onShow"
		@hide="onHide"
	>
		<template #reference>
			<el-badge
				:value="totalUnread"
				:hidden="!totalUnread"
				:max="99"
				class="notif-badge"
			>
				<div class="cl-comm__icon">
					<el-icon :size="16"><bell /></el-icon>
				</div>
			</el-badge>
		</template>

		<div class="notif-panel">
			<div class="notif-panel__header">
				<div
					v-for="tab in tabs"
					:key="tab.value"
					class="notif-panel__tab"
					:class="{ 'is-active': activeTab === tab.value }"
					@click="switchTab(tab.value)"
				>
					{{ tab.label }}
				</div>
			</div>

			<el-scrollbar max-height="400px">
				<!-- 通知 Tab -->
				<div v-if="activeTab === 'notice'" class="notif-panel__body" v-loading="notice.loading">
					<template v-if="notice.list.length">
						<div
							v-for="item in notice.list"
							:key="item.id"
							class="notif-panel__item"
							:class="{ 'is-unread': !item.isRead }"
							@click="onNoticeClick(item)"
						>
							<div class="notif-panel__item-top">
								<el-tag
									:type="getNoticeType(item.type).tagType"
									size="small"
									effect="plain"
									round
								>
									{{ getNoticeType(item.type).label }}
								</el-tag>
								<span class="notif-panel__item-date">
									{{ formatDate(item.sendTime) }}
								</span>
							</div>
							<div class="notif-panel__item-title">{{ item.title }}</div>
							<div class="notif-panel__item-desc">{{ item.content }}</div>
						</div>
						<div v-if="notice.finished" class="notif-panel__tip">没有更多了</div>
					</template>
					<div v-else-if="!notice.loading" class="notif-panel__empty">
						<el-icon :size="40" color="var(--el-text-color-placeholder)">
							<bell-filled />
						</el-icon>
						<p>暂无通知</p>
					</div>
				</div>

				<!-- 消息 Tab -->
				<div v-if="activeTab === 'message'" class="notif-panel__body" v-loading="chat.loading">
					<template v-if="chat.list.length">
						<div
							v-for="item in chat.list"
							:key="item.id"
							class="notif-panel__chat-item"
							@click="onChatClick(item)"
						>
							<cl-avatar
								:size="40"
								:src="item.type === 1 ? item.groupAvatar : item.userAvatar"
								shape="square"
							/>
							<div class="notif-panel__chat-body">
								<div class="notif-panel__chat-top">
									<span class="notif-panel__chat-name">{{ item.name }}</span>
									<span class="notif-panel__chat-time">
										{{ formatDate(item.lastMsg?.createTime || item.updateTime) }}
									</span>
								</div>
								<div class="notif-panel__chat-bottom">
									<span class="notif-panel__chat-msg">
										{{ formatLastMsg(item.lastMsg) }}
									</span>
									<el-badge
										v-if="item.unread > 0"
										:value="item.unread"
										:max="99"
										class="notif-panel__chat-badge"
									/>
								</div>
							</div>
						</div>
					</template>
					<div v-else-if="!chat.loading" class="notif-panel__empty">
						<el-icon :size="40" color="var(--el-text-color-placeholder)">
							<chat-dot-round />
						</el-icon>
						<p>暂无消息</p>
					</div>
				</div>
			</el-scrollbar>

			<div class="notif-panel__footer" @click="viewAll">查看全部</div>
		</div>
	</el-popover>
</template>

<script lang="ts" setup>
defineOptions({ name: 'cl-notification-bell' });

import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue';
import { Bell, BellFilled, ChatDotRound } from '@element-plus/icons-vue';
import { io, type Socket } from 'socket.io-client';
import { ElNotification } from 'element-plus';
import { useCool } from '/@/cool';
import { useBase } from '/$/base';
import { config } from '/@/config';

const { service, router } = useCool();
const { user } = useBase();

const noticeTypeMap: Record<
	number,
	{ label: string; tagType: 'primary' | 'warning' | 'danger' | 'success' }
> = {
	0: { label: '通知', tagType: 'primary' },
	1: { label: '提醒', tagType: 'warning' },
	2: { label: '紧急', tagType: 'danger' },
	3: { label: '更新', tagType: 'success' }
};

const msgTypeLabels: Record<number, string> = {
	0: '',
	1: '[图片]',
	2: '[表情]',
	3: '[语音]',
	4: '[视频]',
	5: '[文件]'
};

function getNoticeType(type: number) {
	return noticeTypeMap[type] || noticeTypeMap[0];
}

function formatDate(dateStr: string) {
	if (!dateStr) return '';
	const d = new Date(dateStr);
	const now = new Date();
	if (d.toDateString() === now.toDateString()) {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (d.toDateString() === yesterday.toDateString()) return '昨天';
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatLastMsg(msg: any) {
	if (!msg) return '';
	if (msg.isSystem) return '[系统消息]';
	const typeLabel = msgTypeLabels[msg.contentType];
	if (typeLabel) return typeLabel;
	return msg.content || '';
}

const tabs = [
	{ label: '通知', value: 'notice' },
	{ label: '消息', value: 'message' }
];

const activeTab = ref('notice');

// 通知数据
const notice = reactive({
	list: [] as any[],
	loading: false,
	finished: false,
	unread: 0,
	page: 1
});

// 聊天数据
const chat = reactive({
	list: [] as any[],
	loading: false
});

const totalUnread = computed(() => {
	const chatUnread = chat.list.reduce((sum, s) => sum + (s.unread || 0), 0);
	return notice.unread + chatUnread;
});

let notifSocket: Socket | null = null;
let chatSocket: Socket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// ========== 通知 ==========

async function fetchNoticeList() {
	notice.loading = true;
	notice.page = 1;
	notice.list = [];
	notice.finished = false;
	try {
		const res = await (service.base.comm as any).noticePage({ page: 1, size: 8 });
		notice.list = res?.list || [];
		const pagination = res?.pagination;
		notice.finished = !pagination || notice.page >= Math.ceil(pagination.total / 8);
	} catch {
		// ignore
	} finally {
		notice.loading = false;
	}
}

async function fetchNoticeUnread() {
	try {
		const res = await (service.base.comm as any).unreadCount();
		notice.unread = typeof res === 'number' ? res : 0;
	} catch {
		// ignore
	}
}

async function onNoticeClick(item: any) {
	if (!item.isRead) {
		try {
			await (service.base.comm as any).markRead({ notificationId: item.id });
			item.isRead = 1;
			if (notice.unread > 0) notice.unread--;
		} catch {
			// ignore
		}
	}
}

// ========== 聊天 ==========

async function fetchChatSessions() {
	chat.loading = true;
	try {
		const res = await (service.chat as any).comm.sessionList();
		chat.list = res || [];
	} catch {
		// ignore
	} finally {
		chat.loading = false;
	}
}

function onChatClick(item: any) {
	router.push({ path: '/my/chat', query: { sessionId: item.sessionId } });
}

// ========== Tab 切换 ==========

function switchTab(tab: string) {
	if (activeTab.value === tab) return;
	activeTab.value = tab;
	if (tab === 'notice') fetchNoticeList();
	else fetchChatSessions();
}

function viewAll() {
	if (activeTab.value === 'notice') {
		router.push('/my/notification');
	} else {
		router.push('/my/chat');
	}
}

function onShow() {
	if (activeTab.value === 'notice') {
		fetchNoticeList();
		fetchNoticeUnread();
	} else {
		fetchChatSessions();
	}
}

function onHide() {}

// ========== Socket ==========

function connectNotifSocket() {
	if (!user.token || notifSocket?.connected) return;
	notifSocket = io(`${config.host}/notification`, {
		query: { token: user.token },
		transports: ['websocket'],
		reconnection: true,
		reconnectionDelay: 3000,
		reconnectionAttempts: 10
	});
	notifSocket.on('notification', (data: any) => {
		if (data.type === 'new_notification') {
			notice.unread++;
			ElNotification({ title: data.title || '新通知', type: 'info', duration: 4000 });
		} else if (data.type === 'force_remind') {
			ElNotification({
				title: data.title || '未读提醒',
				message: data.message,
				type: 'warning',
				duration: 0
			});
		}
	});
}

function connectChatSocket() {
	if (!user.token || chatSocket?.connected) return;
	chatSocket = io(`${config.host}/chat`, {
		auth: { token: user.token },
		transports: ['websocket'],
		reconnection: true,
		reconnectionDelay: 3000,
		reconnectionAttempts: 10
	});
	chatSocket.on('msg', () => {
		fetchChatSessions();
	});
}

function disconnectSockets() {
	notifSocket?.disconnect();
	notifSocket = null;
	chatSocket?.disconnect();
	chatSocket = null;
}

onMounted(() => {
	fetchNoticeUnread();
	fetchChatSessions();
	connectNotifSocket();
	connectChatSocket();
	timer = setInterval(fetchNoticeUnread, 60000);
});

onBeforeUnmount(() => {
	if (timer) clearInterval(timer);
	disconnectSockets();
});
</script>

<style lang="scss">
.notif-badge {
	.el-badge__content {
		z-index: 1;
	}
}

.notification-bell-popover {
	padding: 0 !important;
	border-radius: 12px !important;
	overflow: hidden;
	box-shadow:
		0 6px 30px rgba(0, 0, 0, 0.08),
		0 0 1px rgba(0, 0, 0, 0.1) !important;
}

.notif-panel {
	&__header {
		display: flex;
		padding: 16px 20px 0;
		border-bottom: 1px solid var(--el-border-color-lighter);
	}

	&__tab {
		position: relative;
		padding: 8px 0 14px;
		margin-right: 28px;
		font-size: 15px;
		color: var(--el-text-color-secondary);
		cursor: pointer;
		transition: color 0.2s;
		font-weight: 500;

		&:hover {
			color: var(--el-text-color-primary);
		}

		&.is-active {
			color: var(--el-text-color-primary);

			&::after {
				content: '';
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 2px;
				background: var(--el-color-primary);
				border-radius: 1px;
			}
		}
	}

	&__body {
		min-height: 150px;
	}

	/* 通知项 */
	&__item {
		padding: 14px 20px;
		cursor: pointer;
		transition: background-color 0.15s;
		border-bottom: 1px solid var(--el-border-color-extra-light);

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background-color: var(--el-fill-color-lighter);
		}

		&.is-unread .notif-panel__item-title {
			font-weight: 600;
		}

		&-top {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 8px;
		}

		&-date {
			font-size: 12px;
			color: var(--el-text-color-placeholder);
		}

		&-title {
			font-size: 14px;
			color: var(--el-text-color-primary);
			margin-bottom: 4px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&-desc {
			font-size: 13px;
			color: var(--el-text-color-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	/* 聊天项 */
	&__chat-item {
		display: flex;
		align-items: center;
		padding: 12px 20px;
		cursor: pointer;
		transition: background-color 0.15s;
		border-bottom: 1px solid var(--el-border-color-extra-light);

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background-color: var(--el-fill-color-lighter);
		}

		.cl-avatar {
			flex-shrink: 0;
			margin-right: 12px;
		}
	}

	&__chat-body {
		flex: 1;
		min-width: 0;
	}

	&__chat-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	&__chat-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--el-text-color-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	&__chat-time {
		font-size: 12px;
		color: var(--el-text-color-placeholder);
		margin-left: 8px;
		flex-shrink: 0;
	}

	&__chat-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	&__chat-msg {
		font-size: 13px;
		color: var(--el-text-color-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	&__chat-badge {
		flex-shrink: 0;
		margin-left: 8px;

		.el-badge__content {
			line-height: 16px;
			height: 16px;
			padding: 0 5px;
		}
	}

	&__tip {
		text-align: center;
		padding: 12px 0;
		font-size: 13px;
		color: var(--el-text-color-placeholder);

		&.is-link {
			color: var(--el-color-primary);
			cursor: pointer;

			&:hover {
				opacity: 0.8;
			}
		}
	}

	&__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 0;
		color: var(--el-text-color-placeholder);
		font-size: 13px;

		p {
			margin-top: 10px;
		}
	}

	&__footer {
		text-align: center;
		padding: 12px 0;
		font-size: 14px;
		color: var(--el-color-primary);
		cursor: pointer;
		border-top: 1px solid var(--el-border-color-lighter);
		font-weight: 500;
		transition: background-color 0.15s;

		&:hover {
			background-color: var(--el-fill-color-lighter);
		}
	}
}
</style>
