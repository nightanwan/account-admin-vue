<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key :placeholder="'搜索套餐名称'" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'tenant-package'
});

import { useCrud, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.tenant.package
	},
	app => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{
			type: 'selection',
			width: 60
		},
		{
			prop: 'name',
			label: '套餐名称',
			minWidth: 150
		},
		{
			prop: 'status',
			label: '状态',
			minWidth: 100,
			component: {
				name: 'cl-switch'
			}
		},
		{
			prop: 'accountCount',
			label: '最大账号数',
			minWidth: 110
		},
		{
			prop: 'price',
			label: '价格',
			minWidth: 100,
			formatter(row: any) {
				return row.price != null ? `¥${row.price}` : '-';
			}
		},
		{
			prop: 'sort',
			label: '排序',
			minWidth: 80,
			sortable: 'asc'
		},
		{
			prop: 'remark',
			label: '备注',
			minWidth: 200,
			showOverflowTooltip: true
		},
		{
			prop: 'createTime',
			label: '创建时间',
			sortable: 'desc',
			minWidth: 170
		},
		{
			type: 'op'
		}
	]
});

const Upsert = useUpsert({
	dialog: {
		width: '800px'
	},

	items: [
		{
			label: '套餐名称',
			prop: 'name',
			span: 12,
			required: true,
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入套餐名称'
				}
			}
		},
		{
			label: '状态',
			prop: 'status',
			span: 12,
			value: 1,
			component: {
				name: 'el-radio-group',
				options: [
					{ label: '启用', value: 1 },
					{ label: '禁用', value: 0 }
				]
			}
		},
		{
			label: '最大账号数',
			prop: 'accountCount',
			span: 12,
			value: 10,
			required: true,
			component: {
				name: 'el-input-number',
				props: {
					min: 1,
					max: 99999,
					'controls-position': 'right'
				}
			}
		},
		{
			label: '价格',
			prop: 'price',
			span: 12,
			component: {
				name: 'el-input-number',
				props: {
					min: 0,
					precision: 2,
					'controls-position': 'right',
					placeholder: '选填'
				}
			}
		},
		{
			label: '排序',
			prop: 'sort',
			span: 12,
			value: 0,
			component: {
				name: 'el-input-number',
				props: {
					min: 0,
					max: 999,
					'controls-position': 'right'
				}
			}
		},
		{
			label: '菜单权限',
			prop: 'menuIdList',
			value: [],
			component: {
				name: 'cl-menu-check'
			}
		},
		{
			label: '备注',
			prop: 'remark',
			component: {
				name: 'el-input',
				props: {
					type: 'textarea',
					rows: 3
				}
			}
		}
	]
});
</script>
