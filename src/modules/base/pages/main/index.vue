<template>
	<el-watermark
		v-if="systemConfig.config.watermarkEnabled"
		:content="watermarkText"
		:font="watermarkFont"
		:gap="[100, 100]"
		:offset="[50, 50]"
		class="app-watermark"
	>
		<div class="app-layout" :class="{ 'is-collapse': app.isFold, 'is-full': app.isFull }">
			<div class="app-layout__mask" @click="app.fold(true)"></div>

			<div class="app-layout__left">
				<slider />
			</div>

			<div class="app-layout__right">
				<topbar />
				<process />
				<views />
			</div>
		</div>
	</el-watermark>

	<div
		v-else
		class="app-layout"
		:class="{ 'is-collapse': app.isFold, 'is-full': app.isFull }"
	>
		<div class="app-layout__mask" @click="app.fold(true)"></div>

		<div class="app-layout__left">
			<slider />
		</div>

		<div class="app-layout__right">
			<topbar />
			<process />
			<views />
		</div>
	</div>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'app-layout'
});

import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useBase } from '/$/base';
import Topbar from './components/topbar.vue';
import Slider from './components/slider.vue';
import process from './components/process.vue';
import Views from './components/views.vue';

const { app, user, systemConfig } = useBase();

function formatTime(date: Date) {
	const y = date.getFullYear();
	const M = date.getMonth() + 1;
	const d = date.getDate();
	const h = String(date.getHours()).padStart(2, '0');
	const m = String(date.getMinutes()).padStart(2, '0');
	const s = String(date.getSeconds()).padStart(2, '0');
	return `${y}-${M}-${d} ${h}:${m}:${s}`;
}

const now = ref(formatTime(new Date()));
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
	timer = setInterval(() => {
		now.value = formatTime(new Date());
	}, 1000);
});

onUnmounted(() => {
	if (timer) clearInterval(timer);
});

const watermarkText = computed(() => {
	const cfg = systemConfig.config;
	const userInfo = user.info;

	switch (cfg.watermarkType) {
		case 'nickname':
			return userInfo?.nickName || userInfo?.username || '';
		case 'nickname_time':
			return [
				userInfo?.nickName || userInfo?.username || '',
				now.value
			];
		case 'site_name':
			return cfg.siteName || app.info.name || '';
		case 'custom':
			return cfg.watermarkCustomText || '';
		default:
			return '';
	}
});

const watermarkFont = computed(() => ({
	color: `rgba(0, 0, 0, ${(systemConfig.config.watermarkOpacity || 15) / 100})`,
	fontSize: 16
}));
</script>

<style lang="scss" scoped>
.app-watermark {
	height: 100%;
	width: 100%;
}

.app-global {
	position: absolute;
	left: 0;
	top: 0;
}

.app-layout {
	display: flex;
	background-color: var(--bg-color);
	height: 100%;
	width: 100%;
	overflow: hidden;

	&__left {
		overflow: hidden;
		height: 100%;
		width: 255px;
		transition: left 0.2s;
	}

	&__right {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: calc(100% - 255px);
	}

	&__mask {
		position: fixed;
		left: 0;
		top: 0;
		background-color: rgba(0, 0, 0, 0.5);
		height: 100%;
		width: 100%;
		z-index: 999;
	}

	@media only screen and (max-width: 768px) {
		.app-layout__left {
			position: absolute;
			left: 0;
			z-index: 9999;
			transition:
				transform 0.3s cubic-bezier(0.7, 0.3, 0.1, 1),
				box-shadow 0.3s cubic-bezier(0.7, 0.3, 0.1, 1);
		}

		.app-layout__right {
			width: 100%;
		}

		&.is-collapse {
			.app-layout__left {
				transform: translateX(-100%);
			}

			.app-layout__mask {
				display: none;
			}
		}
	}

	@media only screen and (min-width: 768px) {
		.app-layout__left,
		.app-layout__right {
			transition: width 0.2s ease-in-out;
		}

		.app-layout__mask {
			display: none;
		}

		&.is-collapse {
			.app-layout__left {
				width: 67px;
			}

			.app-layout__right {
				width: calc(100% - 67px);
			}
		}
	}

	&.is-full {
		.app-layout__left {
			width: 0;
		}

		.app-layout__right {
			width: 100%;

			:deep(.a-menu),
			:deep(.app-topbar) {
				padding: 0;
				height: 0;
				overflow: hidden;
			}
		}
	}
}
</style>
