import { useAppStore } from './app';
import { useMenuStore } from './menu';
import { useProcessStore } from './process';
import { useUserStore } from './user';
import { useSystemConfigStore } from './system-config';

export function useStore() {
	const app = useAppStore();
	const menu = useMenuStore();
	const process = useProcessStore();
	const user = useUserStore();
	const systemConfig = useSystemConfigStore();

	return {
		app,
		menu,
		process,
		user,
		systemConfig
	};
}
