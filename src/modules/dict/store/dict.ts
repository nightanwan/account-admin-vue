import { defineStore } from 'pinia';
import { computed, reactive, toRaw } from 'vue';
import { service } from '/@/cool';
import { deepTree } from '/@/cool/utils';
import { isDev } from '/@/config';
import { assign, isArray, isString, orderBy } from 'lodash-es';
import { deepFind, isEmpty } from '../utils';

const useDictStore = defineStore('dict', () => {
	// 对象数据
	const data = reactive<Dict.Data>({});

	// 获取
	function get(name: Dict.Key, sort?: 'desc' | 'asc') {
		return computed(() => orderBy(data[name] || [], 'orderNum', sort));
	}

	// 查找
	function find(name: Dict.Key, value: any | any[]) {
		const arr = isArray(value) ? value : [value];
		return arr.filter(e => e !== undefined).map(v => deepFind(v, get(name).value));
	}

	function getLabel(name: string | any[], value: any): string {
		const arr: any[] = String(value)?.split(',') || [];

		return arr
			.map(e => {
				const items = isString(name) ? get(name).value : name;
				return (items as any[]).find(a => a.value == e)?.label;
			})
			.filter(Boolean)
			.join(',');
	}

	// 刷新
	async function refresh(types?: Dict.Key[]) {
		return service.dict.info
			.data({
				types: types?.filter(e => !isEmpty(e))
			})
			.then((res: Dict.Data) => {
				const d = {};

				for (const [i, arr] of Object.entries(res)) {
					arr.forEach(e => {
						e.label = e.name;

						if (isEmpty(e.value)) {
							e.value = e.id;
						}
					});

					d[i] = deepTree(arr, 'desc');
				}

				assign(data, d);

				if (isDev) {
					console.group('字典数据');
					console.log(toRaw(data));
					console.groupEnd();
				}

				return data;
			});
	}

	return {
		data,
		get,
		find,
		getLabel,
		refresh
	};
});

export { useDictStore };
