<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />
			<cl-flex1 />
			<!-- 条件搜索 -->
			<cl-search ref="Search" />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
				<template #slot-more="{ scope }">
					<el-dropdown
						@command="handleCommand($event, scope.row)"
						style="padding-right: 10px"
					>
						<el-button type="primary" text>更多</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<div v-permission="service.account.account.permission.info">
									<el-dropdown-item command="info"> 查看详情 </el-dropdown-item>
								</div>
								<div
									v-permission="service.account.account.permission.submitToAudit"
								>
									<el-dropdown-item
										:disabled="scope.row.status !== 0"
										command="submit-to-audit"
									>
										提交审核
									</el-dropdown-item>
								</div>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
				<template #slot-audit="{ scope }">
					<el-button
						v-permission="service.account.account.permission.audit"
						type="primary"
						text
						@click="audit(scope.row)"
						>审核</el-button
					>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert">
			<template #slot-audit="{ scope }">
				<el-button type="primary" @click="doAudit(scope)">审核</el-button>
			</template>
		</cl-upsert>
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({
	name: 'account-douyin'
});

import { useCrud, useTable, useUpsert, useSearch } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { useDict } from '/$/dict';
import { ElMessage, ElMessageBox } from 'element-plus';

const { dict } = useDict();
const { service } = useCool();
const accountTitle = '抖音';

const handleCommand = (command: string, row: any) => {
	switch (command) {
		case 'submit-to-audit':
			submitToAudit(row.id);
			break;
		case 'info':
			info(row);
			break;
	}
};

// 提交审核
const submitToAudit = (id: number) => {
	ElMessageBox.confirm('确定要提交审核吗?', '提示', {
		confirmButtonText: '确定',
		cancelButtonText: '取消',
		type: 'warning'
	})
		.then(() => {
			service.account.account
				.submitToAudit({
					id
				})
				.then(() => {
					ElMessage.success('提交审核成功');
					Crud.value?.refresh();
				})
				.catch((err: any) => {
					ElMessage.error(err);
				});
		})
		.catch(() => {});
};

// 表格中的审核按钮：打开表单查看详情
const audit = (row: any) => {
	Upsert.value?.edit(row);
};

// 表单中的审核按钮：调用后端审核接口
const doAudit = (form: any) => {
	ElMessageBox.confirm('请选择审核操作', '审核', {
		confirmButtonText: '通过',
		cancelButtonText: '驳回',
		distinguishCancelAndClose: true,
		type: 'warning'
	})
		.then(() => {
			service.account.account
				.audit({ id: form.id, status: 2 })
				.then(() => {
					ElMessage.success('审核通过');
					Upsert.value?.close();
					Crud.value?.refresh();
				})
				.catch((err: any) => {
					ElMessage.error(err.message || err);
				});
		})
		.catch((action: string) => {
			if (action !== 'cancel') return;
			ElMessageBox.prompt('请输入驳回原因', '驳回', {
				confirmButtonText: '确定',
				cancelButtonText: '取消',
				inputType: 'textarea',
				inputValidator: (val: string) => {
					if (!val || !val.trim()) return '驳回原因不能为空';
					return true;
				}
			})
				.then(({ value }) => {
					service.account.account
						.audit({ id: form.id, status: 8, reason: value })
						.then(() => {
							ElMessage.success('已驳回');
							Upsert.value?.close();
							Crud.value?.refresh();
						})
						.catch((err: any) => {
							ElMessage.error(err.message || err);
						});
				})
				.catch(() => {});
		});
};
// 查看详情
const info = async (row: any) => {
	Upsert.value?.info(row);
};

const generateTitle = () => {
	const parts = [
		// 基础标题（处理打包和粉丝数）
		`${accountTitle}${Upsert.value.form.isPack === 0 ? ' 打包' : ''} ${Upsert.value.form.fansCount || ''}w`.replace(
			/\sw$/,
			''
		),

		// 认证状态（仅当有值时添加）
		dict.getLabel('authStatus', Upsert.value.form.authStatus),

		// 是否蓝改
		Upsert.value.form.isBlueReform == 0 ? '蓝改' : '',

		// 类目（仅当有值时添加）
		dict.getLabel('account_category', Upsert.value.form.category)?.replace(/,/g, ','),

		// 粉丝偏向（确保字典有对应标签且数字存在）
		dict.getLabel('account_fansDirect', Upsert.value.form.fansDirect) &&
		Upsert.value.form.fansDirectNum
			? `粉丝偏向${dict.getLabel('account_fansDirect', Upsert.value.form.fansDirect)}${Upsert.value.form.fansDirectNum}%`
			: '',

		// 粉丝年龄（仅当有值时添加）
		dict.getLabel('account_fansAge', Upsert.value.form.fansAge)?.replace(/,/g, ','),

		// 认证类型（仅当有值时添加）
		dict.getLabel('authenticationType', Upsert.value.form.authenticationType),

		// 橱窗状态（仅当有值时添加）
		dict.getLabel('showcaseStatus', Upsert.value.form.showcaseStatus)
			? `橱窗${dict.getLabel('showcaseStatus', Upsert.value.form.showcaseStatus)}`
			: '',

		// 星图状态（仅当有值时添加）
		dict.getLabel('starImgAuth', Upsert.value.form.starImgAuth)
			? `星图${dict.getLabel('starImgAuth', Upsert.value.form.starImgAuth)}`
			: '',

		// 违规状态（仅当有值时添加）
		dict.getLabel('punishStatus', Upsert.value.form.punishStatus),

		Upsert.value.form.livesVersion === 0 ? '直播版权号' : '',
		Upsert.value.form.isAbnormal === 0 ? '点赞比异常' : '',

		(() => {
			const name = Upsert.value.form?.fansRegion;
			const rate = Upsert.value.form?.fansRegionRate;
			return name && (rate || rate === 0) ? `${name}${rate}%` : '';
		})()
	];

	return parts
		.filter(item => item && item.replace(/\s/g, '')) // 过滤空字符串
		.join(' ')
		.replace(/([^\d.])(\d)/g, '\$1 \$2') // 字母数字间加空格
		.replace(/\s+/g, ' '); // 合并多余空格
};

// cl-upsert
const Upsert = useUpsert({
	props: {
		labelWidth: '120px',
		labelPosition: 'right'
	},
	dialog: {
		width: '75%',
		controls: ['close'],
		height: '70vh'
	},
	items: [
		{
			label: '抖音号',
			prop: 'douyinNum',
			component: {
				name: 'el-input'
			},
			required: true,
			span: 8
		},
		{
			label: '平台ID',
			prop: 'uid',
			component: {
				name: 'el-input'
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝数量(万)',
			prop: 'fansCount',
			component: {
				name: 'el-input-number',
				props: {
					min: 0
				}
			},
			required: true,
			span: 8
		},
		{
			label: '出售价格',
			prop: 'salePrice',
			component: {
				name: 'el-input-number',
				props: {
					min: 0
				}
			},
			required: true,
			span: 8
		},
		{
			label: '底价',
			prop: 'lowestPrice',
			component: {
				name: 'el-input-number',
				props: {
					min: 0
				}
			},
			required: true,
			span: 8
		},
		{
			label: '类目',
			prop: 'category',
			component: {
				name: 'el-select',
				options: dict.get('account_category'),
				props: {
					multiple: true,
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝年龄',
			prop: 'fansAge',
			component: {
				name: 'el-select',
				options: dict.get('account_fansAge'),
				props: {
					multiple: true,
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝偏向',
			prop: 'fansDirect',
			component: {
				name: 'el-select',
				options: dict.get('account_fansDirect'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝偏向比例',
			prop: 'fansDirectNum',
			component: {
				name: 'el-input-number',
				props: {
					min: 0,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝活跃度',
			prop: 'fansActive',
			component: {
				name: 'el-select',
				options: dict.get('account_fansActive'),
				props: {
					clearable: true
				}
			},
			required: true,
			span: 8
		},
		{
			label: '粉丝活跃度比例',
			prop: 'fansActiveRate',
			component: {
				name: 'el-input-number',
				props: {
					min: 0
				}
			},
			required: true,
			span: 8
		},
		{
			label: '开通橱窗',
			prop: 'showcaseStatus',
			component: {
				name: 'el-select',
				options: dict.get('showcaseStatus'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '开通直播',
			prop: 'liveStatus',
			component: {
				name: 'el-select',
				options: dict.get('liveStatus'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '认证主体',
			prop: 'authenticationType',
			component: {
				name: 'el-select',
				options: dict.get('authenticationType'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '违规情况',
			prop: 'punishStatus',
			component: {
				name: 'el-select',
				options: dict.get('punishStatus'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '星图实名认证',
			prop: 'starImgAuth',
			component: {
				name: 'el-select',
				options: dict.get('starImgAuth'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '开通小店',
			prop: 'smallShopStatus',
			component: {
				name: 'el-select',
				options: dict.get('smallShopStatus'),
				props: {
					clearable: true
				}
			},
			required: true,
			span: 8
		},
		{
			label: '八大人群',
			prop: 'eightPeople',
			component: {
				name: 'el-select',
				options: dict.get('eightPeople'),
				props: {
					multiple: true,
					clearable: true
				}
			},
			span: 8
		},
		{
			label: '粉丝设备',
			prop: 'fansDevice',
			component: {
				name: 'el-select',
				options: dict.get('fansDevice'),
				props: {
					multiple: true,
					clearable: true
				}
			},
			span: 8
		},
		{
			label: '是否改实名',
			prop: 'authStatus',
			component: {
				name: 'el-select',
				options: dict.get('authStatus'),
				props: {
					clearable: true,
					onChange() {
						Upsert.value.form.title = generateTitle();
					}
				}
			},
			required: true,
			span: 8
		},
		{
			label: '直播版权号',
			prop: 'livesVersion',
			component: {
				name: 'el-select',
				options: dict.get('livesVersion'),
				props: {
					clearable: true
				}
			},
			required: true,
			span: 8
		},
		{
			label: '点赞比异常',
			prop: 'isAbnormal',
			component: {
				name: 'el-select',
				options: dict.get('isAbnormal'),
				props: {
					clearable: true
				}
			},
			required: true,
			span: 8
		},
		{
			label: '业务图片',
			prop: 'businessUrl',
			component: {
				name: 'cl-upload',
				props: {
					multiple: true,
					drag: true
				}
			},
			required: true
		},
		{
			label: '聊天记录',
			prop: 'chatHisUrl',
			component: {
				name: 'cl-upload',
				props: {
					multiple: true,
					drag: true
				}
			},
			required: true
		},
		{
			label: '标题',
			prop: 'title',
			value: accountTitle,
			component: {
				name: 'el-input',
				props: {
					type: 'textarea',
					rows: 2,
					disabled: true
				}
			}
		}
	],
	onSubmit(data, { next, done }) {
		next({
			...data,
			type: 0
		});
	},
	op: {
		buttons: ['close', 'save', 'slot-audit']
	}
});

// cl-table
const Table = useTable({
	columns: [
		{
			label: '账号ID',
			prop: 'id'
		},
		{
			label: '标题',
			prop: 'title',
			showOverflowTooltip: true
		},
		{
			label: '类目',
			prop: 'category',
			dict: dict.get('account_category')
		},
		{
			label: '粉丝偏向',
			prop: 'fansDirect',
			dict: dict.get('account_fansDirect')
		},
		{
			label: '粉丝活跃度',
			prop: 'fansActive',
			dict: dict.get('account_fansActive')
		},
		{
			label: '出售价格',
			prop: 'salePrice'
		},
		{
			label: '底价',
			prop: 'lowestPrice'
		},
		{
			label: '粉丝数量(万)',
			prop: 'fansCount'
		},
		{
			label: '状态',
			prop: 'status',
			dict: dict.get('account_status')
		},
		{
			type: 'op',
			buttons: ['slot-more', 'edit', 'delete', 'slot-audit'],
			width: 260
		}
	]
});

// cl-search
const Search = useSearch();

// cl-crud
const Crud = useCrud(
	{
		service: service.account.account
	},
	app => {
		app.refresh();
	}
);

// 刷新
function refresh(params?: any) {
	Crud.value?.refresh(params);
}
</script>
