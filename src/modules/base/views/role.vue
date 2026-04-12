<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key :placeholder="$t('搜索名称')" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-dataScope="{ scope }">
				<div>
					<el-select v-model="scope.dataScope" :placeholder="$t('请选择数据范围')">
						<el-option :label="$t('全部数据')" :value="1" />
						<el-option :label="$t('本部门及下属部门')" :value="2" />
						<el-option :label="$t('仅本部门')" :value="3" />
						<el-option :label="$t('仅本人')" :value="4" />
						<el-option :label="$t('自定义')" :value="5" />
					</el-select>

					<div v-if="scope.dataScope === 5" style="margin-top: 10px">
						<cl-dept-check
							v-model="scope.departmentIdList"
							:check-strictly="true"
						/>
					</div>
				</div>
			</template>
		</cl-upsert>
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'sys-role'
});

import { useTable, useUpsert, useCrud } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { service } = useCool();

// cl-crud
const Crud = useCrud({ service: service.base.sys.role }, app => {
	app.refresh();
});

// cl-upsert
const Upsert = useUpsert({
	dialog: {
		width: '800px'
	},

	items: [
		{
			prop: 'name',
			label: t('名称'),
			span: 12,
			required: true,
			component: {
				name: 'el-input'
			}
		},
		{
			prop: 'label',
			label: t('标识'),
			span: 12,
			required: true,
			component: {
				name: 'el-input'
			}
		},
		{
			prop: 'remark',
			label: t('备注'),
			span: 24,
			component: {
				name: 'el-input',
				props: {
					type: 'textarea',
					rows: 4
				}
			}
		},
		{
			label: t('功能权限'),
			prop: 'menuIdList',
			value: [],
			component: {
				name: 'cl-menu-check'
			}
		},
		{
			label: t('数据权限'),
			prop: 'dataScope',
			value: 4,
			component: {
				name: 'slot-dataScope'
			}
		}
	],

	onSubmit(data, { next }) {
		next({
			...data,
			departmentIdList: data.dataScope === 5 ? data.departmentIdList || [] : []
		});
	}
});

// cl-table
const Table = useTable({
	columns: [
		{
			type: 'selection',
			width: 60
		},
		{
			prop: 'name',
			label: t('名称'),
			minWidth: 150
		},
		{
			prop: 'label',
			label: t('标识'),
			minWidth: 120
		},
		{
			prop: 'dataScope',
			label: t('数据范围'),
			minWidth: 120,
			dict: [
				{ label: t('全部数据'), value: 1, type: 'success' },
				{ label: t('本部门及下属'), value: 2, type: 'warning' },
				{ label: t('仅本部门'), value: 3, type: 'info' },
				{ label: t('仅本人'), value: 4, type: 'danger' },
				{ label: t('自定义'), value: 5, type: 'primary' }
			]
		},
		{
			prop: 'remark',
			label: t('备注'),
			showOverflowTooltip: true,
			minWidth: 150
		},
		{
			prop: 'createTime',
			label: t('创建时间'),
			sortable: 'desc',
			minWidth: 170
		},
		{
			prop: 'updateTime',
			label: t('更新时间'),
			sortable: 'custom',
			minWidth: 170
		},
		{
			type: 'op'
		}
	]
});
</script>
