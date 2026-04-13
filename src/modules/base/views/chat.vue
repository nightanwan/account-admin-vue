<template>
	<div class="chat-page">
		<!-- 左侧边栏 -->
		<div class="chat-sidebar">
			<div class="chat-sidebar__search">
				<el-input
					v-model="keyword"
					:placeholder="sidebarTab === 'session' ? '搜索会话' : '搜索用户'"
					prefix-icon="Search"
					clearable
					size="default"
					@input="onSearchInput"
				/>
			</div>

			<div class="chat-sidebar__tabs">
				<div
					class="chat-sidebar__tab"
					:class="{ 'is-active': sidebarTab === 'session' }"
					@click="switchSidebarTab('session')"
				>
					会话
				</div>
				<div
					class="chat-sidebar__tab"
					:class="{ 'is-active': sidebarTab === 'friend' }"
					@click="switchSidebarTab('friend')"
				>
					好友
				</div>
			</div>

			<el-scrollbar class="chat-sidebar__list">
				<!-- 会话列表 -->
				<template v-if="sidebarTab === 'session'">
					<div
						v-for="item in filteredSessions"
						:key="item.id"
						class="chat-sidebar__item"
						:class="{ 'is-active': currentSession?.id === item.id }"
						@click="selectSession(item)"
					>
						<cl-avatar
							:size="42"
							:src="item.type === 1 ? item.groupAvatar : item.userAvatar"
							shape="square"
						/>
						<div class="chat-sidebar__item-body">
							<div class="chat-sidebar__item-top">
								<span class="chat-sidebar__item-name">{{ item.name }}</span>
								<span class="chat-sidebar__item-time">
									{{ formatDate(item.lastMsg?.createTime || item.updateTime) }}
								</span>
							</div>
							<div class="chat-sidebar__item-bottom">
								<span class="chat-sidebar__item-msg">
									{{ formatLastMsg(item.lastMsg) }}
								</span>
								<el-badge
									v-if="item.unread > 0"
									:value="item.unread"
									:max="99"
									class="chat-sidebar__item-badge"
								/>
							</div>
						</div>
					</div>
					<div
						v-if="!filteredSessions.length && !sessionsLoading"
						class="chat-sidebar__empty"
					>
						暂无会话
					</div>
				</template>

				<!-- 好友搜索结果 -->
				<template v-else-if="sidebarTab === 'friend' && keyword.trim()">
					<div v-loading="searchLoading" class="chat-sidebar__section">
						<div
							v-for="item in searchResults"
							:key="item.id"
							class="chat-sidebar__item"
						>
							<cl-avatar :size="42" :src="item.headImg" shape="square" />
							<div class="chat-sidebar__item-body">
								<div class="chat-sidebar__item-top">
									<span class="chat-sidebar__item-name">
										{{ item.nickName || item.username }}
									</span>
								</div>
							</div>
							<el-button v-if="item.isFriend" size="small" disabled round>
								已添加
							</el-button>
							<el-button
								v-else
								size="small"
								type="primary"
								round
								:loading="item._adding"
								@click="addFriend(item)"
							>
								添加
							</el-button>
						</div>
						<div
							v-if="!searchResults.length && !searchLoading"
							class="chat-sidebar__empty"
						>
							未搜索到用户
						</div>
					</div>
				</template>

				<!-- 好友列表 -->
				<template v-else-if="sidebarTab === 'friend'">
					<div v-loading="friendsLoading" class="chat-sidebar__section">
						<div
							v-for="item in friends"
							:key="item.id"
							class="chat-sidebar__item"
							@click="chatWithFriend(item)"
						>
							<cl-avatar :size="42" :src="item.headImg" shape="square" />
							<div class="chat-sidebar__item-body">
								<div class="chat-sidebar__item-top">
									<span class="chat-sidebar__item-name">
										{{ item.nickName || item.username }}
									</span>
								</div>
								<div class="chat-sidebar__item-bottom">
									<span class="chat-sidebar__item-msg">
										{{ item.email || '' }}
									</span>
								</div>
							</div>
							<el-button size="small" text @click.stop="openFriendDetail(item)">
								<el-icon><info-filled /></el-icon>
							</el-button>
						</div>
						<div v-if="!friends.length && !friendsLoading" class="chat-sidebar__empty">
							暂无好友
						</div>
					</div>
				</template>
			</el-scrollbar>
		</div>

		<!-- 右侧聊天区 -->
		<div class="chat-main">
			<template v-if="currentSession">
				<div class="chat-main__header">
					<span class="chat-main__header-name">{{ currentSession.name }}</span>
					<el-tag v-if="currentSession.type === 1" size="small" effect="plain" round>
						群聊
					</el-tag>
				</div>

				<el-scrollbar ref="msgScrollRef" class="chat-main__messages">
					<div ref="msgListRef" class="chat-main__msg-list">
						<div
							v-if="msgHasMore"
							class="chat-main__load-more"
							@click="loadMoreMessages"
						>
							加载更多
						</div>

						<div
							v-for="msg in messages"
							:key="msg.id"
							class="chat-msg"
							:class="{
								'is-self': msg.fromUserId === userId,
								'is-system': msg.isSystem
							}"
						>
							<template v-if="msg.isSystem">
								<div class="chat-msg__system">{{ msg.content }}</div>
							</template>
							<template v-else>
								<cl-avatar
									v-if="msg.fromUserId !== userId"
									:size="36"
									:src="msg.userAvatarUrl"
									shape="square"
									class="chat-msg__avatar"
								/>
								<div class="chat-msg__bubble-wrap">
									<span
										v-if="
											msg.fromUserId !== userId && currentSession?.type === 1
										"
										class="chat-msg__sender"
									>
										{{ msg.userNickName }}
									</span>
								<div class="chat-msg__bubble">
									<template v-if="msg.contentType === 0 || msg.contentType === 2">
										<span class="chat-msg__text">{{ msg.content }}</span>
									</template>
									<el-image
										v-else-if="msg.contentType === 1"
										:src="msg.content"
										:preview-src-list="[msg.content]"
										fit="cover"
										class="chat-msg__img"
									/>
									<div v-else-if="msg.contentType === 3" class="chat-msg__audio">
										<audio :src="msg.content" controls preload="metadata" />
									</div>
									<div v-else-if="msg.contentType === 4" class="chat-msg__video">
										<video :src="msg.content" controls preload="metadata" />
									</div>
									<a
										v-else-if="msg.contentType === 5"
										class="chat-msg__file"
										:href="msg.content"
										target="_blank"
										download
									>
										<el-icon :size="22"><document /></el-icon>
										<span>{{ getFileName(msg.content) }}</span>
									</a>
									<template v-else>
										{{ formatMsgContent(msg) }}
									</template>
								</div>
									<span class="chat-msg__time">
										{{ formatMsgTime(msg.createTime) }}
									</span>
								</div>
								<cl-avatar
									v-if="msg.fromUserId === userId"
									:size="36"
									:src="userInfo?.headImg"
									shape="square"
									class="chat-msg__avatar"
								/>
							</template>
						</div>
					</div>
				</el-scrollbar>

				<div class="chat-main__input">
					<div class="chat-main__toolbar">
						<div class="chat-main__tool-btn" title="图片" @click="triggerUpload('image')">
							<el-icon><picture-icon /></el-icon>
						</div>

						<el-popover
							trigger="click"
							:width="352"
							placement="top-start"
							popper-class="emoji-popover"
						>
							<template #reference>
								<div class="chat-main__tool-btn" title="表情">
									<span class="chat-main__tool-emoji-char">😊</span>
								</div>
							</template>
							<div class="emoji-picker">
								<span
									v-for="e in emojiList"
									:key="e"
									class="emoji-picker__item"
									@click="insertEmoji(e)"
								>
									{{ e }}
								</span>
							</div>
						</el-popover>

						<div class="chat-main__tool-btn" title="语音" @click="triggerUpload('audio')">
							<el-icon><headset /></el-icon>
						</div>
						<div class="chat-main__tool-btn" title="视频" @click="triggerUpload('video')">
							<el-icon><video-camera /></el-icon>
						</div>
						<div class="chat-main__tool-btn" title="文件" @click="triggerUpload('file')">
							<el-icon><paperclip /></el-icon>
						</div>

						<div v-if="uploading" class="chat-main__upload-tip">
							<el-icon class="is-loading"><loading /></el-icon>
							<span>上传中...</span>
						</div>
					</div>

					<div class="chat-main__textarea-wrap">
						<el-input
							ref="textareaRef"
							v-model="inputMsg"
							type="textarea"
							:rows="3"
							resize="none"
							placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
							:disabled="sending || uploading"
							@keydown="onTextareaKeydown"
						/>
						<el-button
							type="primary"
							:loading="sending"
							:disabled="uploading"
							class="chat-main__send-btn"
							@click="sendMessage"
						>
							发送
						</el-button>
					</div>

					<input
						ref="imageInputRef"
						type="file"
						accept="image/*"
						hidden
						@change="onFileChange($event, 1)"
					/>
					<input
						ref="audioInputRef"
						type="file"
						accept="audio/*"
						hidden
						@change="onFileChange($event, 3)"
					/>
					<input
						ref="videoInputRef"
						type="file"
						accept="video/*"
						hidden
						@change="onFileChange($event, 4)"
					/>
					<input
						ref="fileInputRef"
						type="file"
						hidden
						@change="onFileChange($event, 5)"
					/>
				</div>
			</template>

			<div v-else class="chat-main__placeholder">
				<el-icon :size="64" color="var(--el-text-color-placeholder)">
					<chat-dot-round />
				</el-icon>
				<p>选择一个会话开始聊天</p>
			</div>
		</div>

		<!-- 好友详情抽屉 -->
		<el-drawer
			v-model="friendDetailVisible"
			size="340px"
			:with-header="false"
			append-to-body
			class="friend-drawer"
		>
			<div class="friend-detail" v-if="friendDetail">
				<div class="friend-detail__header">
					<div class="friend-detail__avatar-ring">
						<cl-avatar :size="80" :src="friendDetail.headImg" shape="square" />
					</div>
					<h3>{{ friendDetail.nickName || friendDetail.username }}</h3>
					<span class="friend-detail__subtitle">
						{{ friendDetail.email || '暂无邮箱' }}
					</span>
				</div>

				<div class="friend-detail__card">
					<div class="friend-detail__row">
						<span class="friend-detail__label">用户名</span>
						<span class="friend-detail__value">
							{{ friendDetail.username || '-' }}
						</span>
					</div>
					<div class="friend-detail__row">
						<span class="friend-detail__label">昵称</span>
						<span class="friend-detail__value">
							{{ friendDetail.nickName || '-' }}
						</span>
					</div>
					<div class="friend-detail__row">
						<span class="friend-detail__label">手机号</span>
						<span class="friend-detail__value">
							{{ friendDetail.phone || '-' }}
						</span>
					</div>
					<div class="friend-detail__row">
						<span class="friend-detail__label">邮箱</span>
						<span class="friend-detail__value">
							{{ friendDetail.email || '-' }}
						</span>
					</div>
				</div>

				<div class="friend-detail__actions">
					<el-button type="primary" round @click="chatWithFriendFromDetail">
						发送消息
					</el-button>
					<el-button round plain @click="deleteFriend" class="friend-detail__del-btn">
						删除好友
					</el-button>
				</div>
			</div>
		</el-drawer>
	</div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'chat-page' });

import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import {
	ChatDotRound,
	InfoFilled,
	Picture as PictureIcon,
	Headset,
	VideoCamera,
	Paperclip,
	Document,
	Loading
} from '@element-plus/icons-vue';
import { io, type Socket } from 'socket.io-client';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useCool } from '/@/cool';
import { useBase } from '/$/base';
import { config } from '/@/config';
import { useRoute } from 'vue-router';
import { debounce } from 'lodash-es';
import { useUpload } from '/@/plugins/upload/hooks';

const { service } = useCool();
const { user } = useBase();
const route = useRoute();
const chatComm = (service.chat as any).comm;
const { toUpload } = useUpload();

const userId = computed(() => user.info?.id);
const userInfo = computed(() => user.info);

const msgTypeLabels: Record<number, string> = {
	1: '[图片]',
	2: '[表情]',
	3: '[语音]',
	4: '[视频]',
	5: '[文件]'
};

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
	return msgTypeLabels[msg.contentType] || msg.content || '';
}

function formatMsgContent(msg: any) {
	return msgTypeLabels[msg.contentType] || msg.content || '';
}

function formatMsgTime(dateStr: string) {
	if (!dateStr) return '';
	const d = new Date(dateStr);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ========== 左侧边栏 Tab ==========

const sidebarTab = ref<'session' | 'friend'>('session');
const keyword = ref('');

function switchSidebarTab(tab: 'session' | 'friend') {
	sidebarTab.value = tab;
	keyword.value = '';
	searchResults.value = [];
	if (tab === 'friend') fetchFriends();
}

// ========== 会话列表 ==========

const sessions = ref<any[]>([]);
const sessionsLoading = ref(false);
const currentSession = ref<any>(null);

const filteredSessions = computed(() => {
	if (!keyword.value) return sessions.value;
	const k = keyword.value.toLowerCase();
	return sessions.value.filter((s: any) => s.name?.toLowerCase().includes(k));
});

async function fetchSessions() {
	sessionsLoading.value = true;
	try {
		const res = await chatComm.sessionList();
		sessions.value = res || [];
	} catch {
		// ignore
	} finally {
		sessionsLoading.value = false;
	}
}

async function selectSession(item: any) {
	sidebarTab.value = 'session';
	currentSession.value = item;
	msgPage.value = 1;
	msgHasMore.value = true;
	messages.value = [];
	await fetchMessages(true);
	markRead(item);
	scrollToBottom();
}

async function markRead(item: any) {
	if (item.unread > 0) {
		try {
			await chatComm.msgRead({ sessionId: item.sessionId });
			item.unread = 0;
		} catch {
			// ignore
		}
	}
}

// ========== 好友列表 ==========

const friends = ref<any[]>([]);
const friendsLoading = ref(false);

async function fetchFriends() {
	friendsLoading.value = true;
	try {
		const res = await chatComm.friendList();
		friends.value = res || [];
	} catch {
		// ignore
	} finally {
		friendsLoading.value = false;
	}
}

async function chatWithFriend(item: any) {
	try {
		const res = await chatComm.sessionFind({ friendId: item.friendId || item.id });
		if (res) {
			await fetchSessions();
			const target = sessions.value.find(
				(s: any) => String(s.sessionId) === String(res.sessionId)
			);
			if (target) {
				selectSession(target);
				return;
			}
		}
	} catch {
		// ignore
	}
	ElMessage.info('暂无会话，请先发起消息');
}

// ========== 搜索用户 + 添加好友 ==========

const searchResults = ref<any[]>([]);
const searchLoading = ref(false);

const doSearch = debounce(async (kw: string) => {
	if (!kw.trim()) {
		searchResults.value = [];
		return;
	}
	searchLoading.value = true;
	try {
		const res = await chatComm.friendSearch({ username: kw.trim() });
		if (res) {
			searchResults.value = [{ ...res, _adding: false }];
		} else {
			searchResults.value = [];
		}
	} catch {
		searchResults.value = [];
	} finally {
		searchLoading.value = false;
	}
}, 400);

function onSearchInput() {
	if (sidebarTab.value === 'friend' && keyword.value.trim()) {
		doSearch(keyword.value);
	}
}

async function addFriend(item: any) {
	item._adding = true;
	try {
		await chatComm.friendBind({ friendId: item.id });
		item.isFriend = true;
		ElMessage.success('添加成功');
		fetchFriends();
		fetchSessions();
	} catch {
		ElMessage.error('添加失败');
	} finally {
		item._adding = false;
	}
}

// ========== 好友详情 ==========

const friendDetailVisible = ref(false);
const friendDetail = ref<any>(null);
let friendDetailRaw: any = null;

async function openFriendDetail(item: any) {
	friendDetailRaw = item;
	try {
		const res = await chatComm.friendDetail({ friendId: item.friendId || item.id });
		friendDetail.value = res || item;
	} catch {
		friendDetail.value = item;
	}
	friendDetailVisible.value = true;
}

async function chatWithFriendFromDetail() {
	friendDetailVisible.value = false;
	if (friendDetailRaw) chatWithFriend(friendDetailRaw);
}

async function deleteFriend() {
	if (!friendDetailRaw) return;
	try {
		await ElMessageBox.confirm('确定删除该好友？删除后会话记录将被清除。', '提示', {
			type: 'warning'
		});
		await chatComm.friendDelete({
			ids: [friendDetailRaw.id]
		});
		ElMessage.success('已删除');
		friendDetailVisible.value = false;
		fetchFriends();
		fetchSessions();
	} catch {
		// cancelled or error
	}
}

// ========== Emoji ==========

const emojiList = [
	'😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
	'🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
	'😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑',
	'🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
	'😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪',
	'😴', '😷', '🤒', '🤕', '🤢', '🥵', '🥶', '😵',
	'🤯', '🤠', '🥳', '😎', '🤓', '😕', '😟', '🙁',
	'😮', '😯', '😲', '😳', '🥺', '😨', '😰', '😥',
	'😢', '😭', '😱', '😖', '😣', '😞', '😩', '😫',
	'👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
	'👋', '👏', '🙌', '🤝', '🙏', '❤️', '🔥', '⭐',
	'🎉', '💯', '✅', '❌', '⚡', '💪', '👀', '💬'
];

const textareaRef = ref<any>(null);

function insertEmoji(emoji: string) {
	inputMsg.value += emoji;
	nextTick(() => {
		textareaRef.value?.focus?.();
	});
}

// ========== 文件上传 ==========

const imageInputRef = ref<HTMLInputElement>();
const audioInputRef = ref<HTMLInputElement>();
const videoInputRef = ref<HTMLInputElement>();
const fileInputRef = ref<HTMLInputElement>();
const uploading = ref(false);

function triggerUpload(type: string) {
	const refMap: Record<string, any> = {
		image: imageInputRef,
		audio: audioInputRef,
		video: videoInputRef,
		file: fileInputRef
	};
	refMap[type]?.value?.click();
}

async function onFileChange(e: Event, contentType: number) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file || !currentSession.value) return;
	input.value = '';

	uploading.value = true;
	try {
		const res = await toUpload(file);
		if (chatSocket?.connected) {
			chatSocket.emit('send', {
				sessionId: currentSession.value.sessionId,
				content: res.url,
				contentType,
				data: { name: file.name, size: file.size }
			});
		}
	} catch {
		ElMessage.error('文件上传失败');
	} finally {
		uploading.value = false;
	}
}

function getFileName(url: string) {
	if (!url) return '文件';
	try {
		const decoded = decodeURIComponent(url);
		const name = decoded.split('/').pop()?.split('?')[0] || '文件';
		return name.length > 30 ? name.slice(0, 27) + '...' : name;
	} catch {
		return '文件';
	}
}

// ========== 消息 ==========

const messages = ref<any[]>([]);
const msgPage = ref(1);
const msgHasMore = ref(true);
const msgScrollRef = ref<any>(null);
const msgListRef = ref<HTMLElement>();
const inputMsg = ref('');
const sending = ref(false);
const MSG_SIZE = 30;

async function fetchMessages(isInit = false) {
	if (!currentSession.value) return;
	try {
		const res = await chatComm.msgPage({
			sessionId: currentSession.value.sessionId,
			page: msgPage.value,
			size: MSG_SIZE
		});
		const list = (res?.list || []).reverse();
		if (isInit) {
			messages.value = list;
		} else {
			messages.value.unshift(...list);
		}
		const pagination = res?.pagination;
		if (pagination) {
			msgHasMore.value = msgPage.value < Math.ceil(pagination.total / MSG_SIZE);
		} else {
			msgHasMore.value = list.length >= MSG_SIZE;
		}
	} catch {
		// ignore
	}
}

async function loadMoreMessages() {
	if (!msgHasMore.value) return;
	msgPage.value++;
	const oldHeight = msgListRef.value?.scrollHeight || 0;
	await fetchMessages(false);
	await nextTick();
	const newHeight = msgListRef.value?.scrollHeight || 0;
	if (msgScrollRef.value) {
		msgScrollRef.value.setScrollTop(newHeight - oldHeight);
	}
}

function onTextareaKeydown(e: Event | KeyboardEvent) {
	const ke = e as KeyboardEvent;
	if (ke.key === 'Enter' && !ke.shiftKey) {
		ke.preventDefault();
		sendMessage();
	}
}

async function sendMessage() {
	const text = inputMsg.value.trim();
	if (!text || !currentSession.value || sending.value) return;
	sending.value = true;
	if (chatSocket?.connected) {
		chatSocket.emit('send', {
			sessionId: currentSession.value.sessionId,
			content: text,
			contentType: 0
		});
		inputMsg.value = '';
	}
	sending.value = false;
}

function scrollToBottom() {
	nextTick(() => {
		if (msgScrollRef.value && msgListRef.value) {
			msgScrollRef.value.setScrollTop(msgListRef.value.scrollHeight);
		}
	});
}

// ========== Socket ==========

let chatSocket: Socket | null = null;

function connectChatSocket() {
	if (!user.token || chatSocket?.connected) return;
	chatSocket = io(`${config.host}/chat`, {
		auth: { token: user.token },
		transports: ['websocket'],
		reconnection: true,
		reconnectionDelay: 3000,
		reconnectionAttempts: 10
	});
	chatSocket.on('msg', (data: any) => {
		if (currentSession.value && data.sessionId === currentSession.value.sessionId) {
			messages.value.push(data);
			scrollToBottom();
			markRead(currentSession.value);
		}
		fetchSessions();
	});
}

// ========== 初始化 ==========

watch(
	() => route.query.sessionId,
	async sid => {
		if (sid && sessions.value.length) {
			const target = sessions.value.find((s: any) => String(s.sessionId) === String(sid));
			if (target) selectSession(target);
		}
	}
);

onMounted(async () => {
	await fetchSessions();
	connectChatSocket();
	const sid = route.query.sessionId;
	if (sid) {
		const target = sessions.value.find((s: any) => String(s.sessionId) === String(sid));
		if (target) selectSession(target);
	}
});

onBeforeUnmount(() => {
	chatSocket?.disconnect();
	chatSocket = null;
});
</script>

<style lang="scss" scoped>
.chat-page {
	display: flex;
	height: calc(100vh - 135px);
	margin: 10px;
	background: var(--el-bg-color);
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ===== 左侧边栏 ===== */
.chat-sidebar {
	width: 300px;
	border-right: 1px solid var(--el-border-color-lighter);
	display: flex;
	flex-direction: column;
	flex-shrink: 0;

	&__search {
		padding: 16px 16px 12px;
	}

	&__tabs {
		display: flex;
		padding: 0 16px 12px;
		gap: 4px;
	}

	&__tab {
		flex: 1;
		text-align: center;
		padding: 6px 0;
		font-size: 13px;
		font-weight: 500;
		color: var(--el-text-color-secondary);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;

		&:hover {
			color: var(--el-text-color-primary);
			background: var(--el-fill-color-lighter);
		}

		&.is-active {
			color: var(--el-color-primary);
			background: var(--el-color-primary-light-9);
		}
	}

	&__list {
		flex: 1;
	}

	&__section {
		min-height: 100px;
	}

	&__item {
		display: flex;
		align-items: center;
		padding: 10px 16px;
		cursor: pointer;
		transition: background-color 0.15s;

		&:hover {
			background-color: var(--el-fill-color-lighter);
		}

		&.is-active {
			background-color: var(--el-fill-color-light);
		}

		.cl-avatar {
			flex-shrink: 0;
			margin-right: 12px;
		}

		&-body {
			flex: 1;
			min-width: 0;
		}

		&-top {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 3px;
		}

		&-name {
			font-size: 14px;
			font-weight: 500;
			color: var(--el-text-color-primary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex: 1;
		}

		&-time {
			font-size: 12px;
			color: var(--el-text-color-placeholder);
			margin-left: 8px;
			flex-shrink: 0;
		}

		&-bottom {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		&-msg {
			font-size: 13px;
			color: var(--el-text-color-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex: 1;
		}

		&-badge {
			flex-shrink: 0;
			margin-left: 8px;

			:deep(.el-badge__content) {
				line-height: 16px;
				height: 16px;
				padding: 0 5px;
			}
		}
	}

	&__empty {
		text-align: center;
		padding: 40px 0;
		color: var(--el-text-color-placeholder);
		font-size: 13px;
	}
}

/* ===== 右侧聊天区 ===== */
.chat-main {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;

	&__header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--el-border-color-lighter);
		font-size: 16px;
		font-weight: 600;
		color: var(--el-text-color-primary);
	}

	&__messages {
		flex: 1;
	}

	&__msg-list {
		padding: 16px 24px;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	&__load-more {
		text-align: center;
		padding: 12px 0;
		font-size: 13px;
		color: var(--el-color-primary);
		cursor: pointer;

		&:hover {
			opacity: 0.8;
		}
	}

	&__input {
		border-top: 1px solid var(--el-border-color-lighter);
		flex-shrink: 0;
	}

	&__toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 10px 24px 0;
	}

	&__tool-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
		color: var(--el-text-color-regular);

		.el-icon {
			font-size: 20px;
		}

		&:hover {
			color: var(--el-color-primary);
			background: var(--el-color-primary-light-9);
		}
	}

	&__tool-emoji-char {
		font-size: 20px;
		line-height: 1;
	}

	&__upload-tip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: 8px;
		font-size: 12px;
		color: var(--el-color-primary);
	}

	&__textarea-wrap {
		display: flex;
		align-items: flex-end;
		padding: 6px 24px 14px;
		gap: 10px;

		:deep(.el-textarea__inner) {
			box-shadow: none !important;
			padding: 8px 0;
			font-size: 14px;
			line-height: 1.5;
		}
	}

	&__send-btn {
		flex-shrink: 0;
		height: 36px;
		padding: 0 20px;
		border-radius: 8px;
	}

	&__placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--el-text-color-placeholder);
		font-size: 14px;

		p {
			margin-top: 16px;
		}
	}
}

/* ===== 消息气泡 ===== */
.chat-msg {
	display: flex;
	align-items: flex-start;
	margin-bottom: 16px;

	&.is-self {
		flex-direction: row-reverse;

		.chat-msg__bubble-wrap {
			align-items: flex-end;
		}

		.chat-msg__bubble {
			background: var(--el-color-primary);
			color: #fff;
			border-radius: 12px 2px 12px 12px;
		}

		.chat-msg__avatar {
			margin-left: 10px;
			margin-right: 0;
		}
	}

	&.is-system {
		justify-content: center;
		margin-bottom: 12px;
	}

	&__system {
		font-size: 12px;
		color: var(--el-text-color-placeholder);
		background: var(--el-fill-color);
		padding: 4px 12px;
		border-radius: 12px;
	}

	&__avatar {
		flex-shrink: 0;
		margin-right: 10px;
	}

	&__bubble-wrap {
		display: flex;
		flex-direction: column;
		max-width: 60%;
	}

	&__sender {
		font-size: 12px;
		color: var(--el-text-color-secondary);
		margin-bottom: 4px;
	}

	&__bubble {
		padding: 10px 14px;
		background: var(--el-fill-color-light);
		border-radius: 2px 12px 12px 12px;
		font-size: 14px;
		line-height: 1.5;
		color: var(--el-text-color-primary);
		word-break: break-word;
	}

	&__text {
		white-space: pre-wrap;
		word-break: break-word;
	}

	&__img {
		max-width: 200px;
		max-height: 200px;
		border-radius: 8px;
		cursor: pointer;
	}

	&__audio {
		audio {
			height: 36px;
			max-width: 240px;
		}
	}

	&__video {
		video {
			max-width: 300px;
			max-height: 220px;
			border-radius: 8px;
		}
	}

	&__file {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--el-fill-color);
		border-radius: 8px;
		color: var(--el-text-color-primary);
		text-decoration: none;
		font-size: 13px;
		transition: background 0.15s;
		max-width: 260px;

		&:hover {
			background: var(--el-fill-color-dark);
		}

		.el-icon {
			flex-shrink: 0;
			color: var(--el-text-color-secondary);
		}

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	&__time {
		font-size: 11px;
		color: var(--el-text-color-placeholder);
		margin-top: 4px;
	}
}

/* ===== 好友详情抽屉 ===== */
.friend-detail {
	padding: 0;

	&__header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 24px 24px;
		background: linear-gradient(135deg, var(--el-color-primary-light-8) 0%, var(--el-color-primary-light-9) 100%);
		border-radius: 0 0 20px 20px;

		h3 {
			margin: 16px 0 4px;
			font-size: 18px;
			font-weight: 600;
			color: var(--el-text-color-primary);
		}
	}

	&__avatar-ring {
		padding: 4px;
		border-radius: 14px;
		background: var(--el-bg-color);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	&__subtitle {
		font-size: 13px;
		color: var(--el-text-color-secondary);
	}

	&__card {
		margin: 20px 20px 0;
		padding: 4px 0;
		background: var(--el-fill-color-lighter);
		border-radius: 12px;
	}

	&__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 18px;

		& + & {
			border-top: 1px solid var(--el-border-color-extra-light);
		}
	}

	&__label {
		font-size: 13px;
		color: var(--el-text-color-secondary);
		flex-shrink: 0;
	}

	&__value {
		font-size: 13px;
		color: var(--el-text-color-primary);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-left: 16px;
	}

	&__actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 24px 20px 0;

		.el-button {
			width: 100%;
			height: 40px;
			font-size: 14px;
			margin-left: 0 !important;
		}
	}

	&__del-btn {
		color: var(--el-color-danger) !important;
		border-color: var(--el-color-danger-light-5) !important;

		&:hover {
			color: #fff !important;
			background: var(--el-color-danger) !important;
			border-color: var(--el-color-danger) !important;
		}
	}
}
</style>

<style lang="scss">
.friend-drawer {
	.el-drawer__body {
		padding: 0 !important;
	}
}

.emoji-popover {
	padding: 10px !important;
}

.emoji-picker {
	display: grid;
	grid-template-columns: repeat(8, 1fr);
	gap: 2px;
	max-height: 260px;
	overflow-y: auto;

	&__item {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		width: 38px;
		height: 38px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.12s;
		user-select: none;

		&:hover {
			background: var(--el-fill-color-light);
			transform: scale(1.15);
		}
	}
}
</style>
