import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { service } from '/@/cool';
import { useAppStore } from './app';

export interface SystemConfig {
	siteName: string;
	siteDescription: string;
	siteLogo: string;
	copyright: string;
	watermarkEnabled: boolean;
	watermarkType: 'nickname' | 'nickname_time' | 'site_name' | 'custom';
	watermarkCustomText: string;
	watermarkOpacity: number;
}

const DEFAULT_CONFIG: SystemConfig = {
	siteName: '',
	siteDescription: '',
	siteLogo: '',
	copyright: '',
	watermarkEnabled: false,
	watermarkType: 'nickname',
	watermarkCustomText: '',
	watermarkOpacity: 15
};

export const useSystemConfigStore = defineStore('system-config', function () {
	const config = reactive<SystemConfig>({ ...DEFAULT_CONFIG });

	async function load() {
		try {
			const res = await service.base.comm.request({
				url: '/getConfig',
				method: 'POST',
				data: {
					groupCode: 'system'
				},
				__skipEncrypt: true
			});
			if (res) {
				Object.assign(config, { ...DEFAULT_CONFIG, ...res });
			}
		} catch (err) {
			console.error('加载系统配置失败', err);
		}

		if (config.siteName) {
			const app = useAppStore();
			app.set({ name: config.siteName });
			document.title = config.siteName;
		}
	}

	return {
		config,
		load
	};
});
