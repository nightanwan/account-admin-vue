import { createApp } from 'vue';
import App from './App.vue';
import { bootstrap } from './cool';
import { applyDevtoolProtection } from './cool/utils/devtool';
import { interfaceEncryption } from './cool/utils/encrypt';

const app = createApp(App);

interfaceEncryption
	.init()
	.then(security => applyDevtoolProtection(security.disableDevtool))
	.catch(err => {
		console.warn('[security] load security config failed', err);
	});

// 启动
bootstrap(app)
	.then(() => {
		app.mount('#app');
	})
	.catch(err => {
		console.error('COOL-ADMIN 启动失败', err);
	});
