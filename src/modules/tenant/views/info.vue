<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-search ref="Search" />
		</cl-row>
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />
			<cl-flex1 />
			<!-- 条件搜索 -->
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-status="{ scope }">
					<el-tag v-if="scope.row.status === 1" type="success">启用</el-tag>
					<el-tag v-else-if="scope.row.status === 0" type="danger">禁用</el-tag>
					<el-tag v-else-if="scope.row.status === 2" type="warning">已过期</el-tag>
				</template>
			</cl-table>
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
	name: 'tenant-info'
});

import { useCrud, useTable, useUpsert, useSearch } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { ref } from 'vue';

const { service } = useCool();

const packageOptions = ref<any[]>([]);

async function getPackageOptions() {
	const res = await service.tenant.package.list({ status: 1 });
	packageOptions.value = (res || []).map((e: any) => ({
		label: `${e.name}（${e.accountCount}人）`,
		value: e.id,
		accountCount: e.accountCount
	}));
}

const Crud = useCrud(
	{
		service: service.tenant.info
	},
	app => {
		app.refresh();
	}
);

const Search = useSearch({
	resetBtn: true,
	items: [
		{
			label: '租户名称',
			prop: 'name',
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入租户名称'
				}
			}
		},
		{
			label: '租户编码',
			prop: 'code',
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入租户编码'
				}
			}
		},
		{
			label: '联系人',
			prop: 'contactPerson',
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入联系人'
				}
			}
		}
	]
});
const Table = useTable({
	columns: [
		{
			type: 'selection',
			width: 60
		},
		{
			prop: 'name',
			label: '租户名称',
			minWidth: 150
		},
		{
			prop: 'code',
			label: '租户编码',
			minWidth: 120
		},
		{
			prop: 'packageName',
			label: '套餐',
			minWidth: 120
		},
		{
			prop: 'contactPerson',
			label: '联系人',
			minWidth: 100
		},
		{
			prop: 'phone',
			label: '联系电话',
			minWidth: 120
		},
		{
			prop: 'accountCount',
			label: '账号上限',
			minWidth: 90
		},
		{
			prop: 'userCount',
			label: '已用账号',
			minWidth: 90
		},
		{
			prop: 'status',
			label: '状态',
			minWidth: 90
		},
		{
			prop: 'expireTime',
			label: '过期时间',
			minWidth: 170
		},
		{
			prop: 'createTime',
			label: '创建时间',
			sortable: 'desc',
			minWidth: 170
		},
		{
			type: 'op',
			width: 200
		}
	]
});

const Upsert = useUpsert({
	dialog: {
		width: '850px'
	},

	items: [
		{
			label: '租户名称',
			prop: 'name',
			span: 12,
			required: true,
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入租户名称'
				}
			}
		},
		{
			label: '租户编码',
			prop: 'code',
			span: 12,
			required: true,
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入唯一编码，如 company_a'
				}
			}
		},
		{
			label: '关联套餐',
			prop: 'packageId',
			span: 12,
			required: true,
			component: {
				name: 'el-select',
				options: packageOptions,
				props: {
					placeholder: '请选择套餐'
				}
			}
		},
		{
			label: '账号上限',
			prop: 'accountCount',
			span: 12,
			component: {
				name: 'el-input-number',
				props: {
					min: 1,
					max: 99999,
					placeholder: '不填则使用套餐默认值'
				}
			}
		},
		{
			label: '过期时间',
			prop: 'expireTime',
			span: 12,
			component: {
				name: 'el-date-picker',
				props: {
					type: 'datetime',
					valueFormat: 'YYYY-MM-DD HH:mm:ss',
					placeholder: '请选择过期时间'
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
			label: '联系人',
			prop: 'contactPerson',
			span: 12,
			component: {
				name: 'el-input'
			}
		},
		{
			label: '联系电话',
			prop: 'phone',
			span: 12,
			component: {
				name: 'el-input'
			}
		},
		{
			label: '邮箱',
			prop: 'email',
			span: 12,
			component: {
				name: 'el-input'
			}
		},
		{
			label: '地址',
			prop: 'address',
			span: 12,
			component: {
				name: 'el-input'
			}
		},
		{
			label: '租户Logo',
			prop: 'logo',
			component: {
				name: 'cl-upload',
				props: {
					text: '选择Logo'
				}
			}
		},
		{
			label: '管理员账号',
			prop: 'username',
			span: 12,
			required: true,
			hidden: ({ scope }) => scope.id,
			component: {
				name: 'el-input',
				props: {
					placeholder: '租户管理员登录账号'
				}
			}
		},
		() => {
			return {
				label: '管理员密码',
				prop: 'password',
				span: 12,
				required: Upsert.value?.mode === 'add',
				hidden: ({ scope }: any) => scope.id,
				component: {
					name: 'el-input',
					props: {
						type: 'password',
						showPassword: true,
						placeholder: '租户管理员登录密码',
						autocomplete: 'new-password'
					}
				},
				rules: [
					{
						min: 6,
						max: 16,
						message: '密码长度在 6 到 16 个字符'
					}
				]
			};
		},
		{
			label: '管理员姓名',
			prop: 'adminName',
			span: 12,
			hidden: ({ scope }) => scope.id,
			component: {
				name: 'el-input',
				props: {
					placeholder: '管理员姓名（选填）'
				}
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
	],

	async onOpen() {
		await getPackageOptions();
	}
});
</script>
