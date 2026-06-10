<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 条件搜索 -->
			<cl-search ref="Search" />
		</cl-row>
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-flex1 />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
				<!-- 已读人数 -->
				<template #column-readCount="{ scope }">
					<span v-if="scope.row.status !== 1">
						{{ scope.row.readCount + '/' + scope.row.totalCount }}
					</span>
					<span v-else class="clickable-count" @click="handleShowUsers(scope.row, 1)">
						{{ scope.row.readCount + '/' + scope.row.totalCount }}
					</span>
				</template>

				<!-- 未读人数 -->
				<template #column-unreadCount="{ scope }">
					<span v-if="scope.row.status !== 1">
						{{ scope.row.unreadCount + '/' + scope.row.totalCount }}
					</span>
					<span v-else class="clickable-count" @click="handleShowUsers(scope.row, 0)">
						{{ scope.row.unreadCount + '/' + scope.row.totalCount }}
					</span>
				</template>

				<!-- 自定义操作菜单 -->
				<template #slot-menu="{ scope }">
					<!-- 撤回：仅当状态是 1 (已发送) 时显示 -->
					<el-button
						type="warning"
						v-if="scope.row.status === 1"
						@click="recallNotification(scope.row)"
						text
					>
						撤回
					</el-button>
					<!-- 操作：仅当状态不是 1 (已发送) 时显示 -->
					<el-dropdown trigger="click" v-else>
						<el-button type="primary" text> 操作 </el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item
									v-if="scope.row.status !== 1"
									@click="copyNotification(scope.row, 'update')"
								>
									编辑
								</el-dropdown-item>
								<el-dropdown-item
									v-if="scope.row.status !== 1"
									@click="republishNotification(scope.row)"
								>
									重新发布
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
				<template #slot-copy="{ scope }">
					<el-button
						type="primary"
						style="margin-left: 10px"
						text
						@click="copyNotification(scope.row, 'copy')"
					>
						复制
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert"> </cl-upsert>
		<!-- 复制表单 -->
		<cl-form ref="CopyForm"></cl-form>

		<!-- 已读/未读人员列表弹窗 -->
		<el-dialog
			v-model="readUserListVisible"
			:title="userDialogTitle"
			width="600px"
			:close-on-click-modal="true"
		>
			<el-table
				v-loading="userListLoading"
				:data="readUserList"
				style="width: 100%"
				border
				height="400"
			>
				<el-table-column prop="userName" label="姓名" min-width="120" />
				<el-table-column label="所属部门" min-width="120">
					<template #default="scope">
						{{ getDepartmentName(scope.row.departmentId) }}
					</template>
				</el-table-column>
				<el-table-column label="状态" width="80">
					<template #default="scope">
						<el-tag :type="scope.row.isRead === 1 ? 'success' : 'info'" size="small">
							{{ scope.row.isRead === 1 ? '已读' : '未读' }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="readTime" label="阅读时间" min-width="160">
					<template #default="scope">
						{{ scope.row.readTime || '-' }}
					</template>
				</el-table-column>
			</el-table>

			<div style="margin-top: 20px; display: flex; justify-content: flex-end">
				<el-pagination
					v-model:current-page="readUserPageData.pageNum"
					v-model:page-size="readUserPageData.pageSize"
					:total="readUserPageData.total"
					:page-sizes="[10, 20, 50]"
					layout="total, sizes, prev, pager, next"
					@size-change="fetchUserList"
					@current-change="fetchUserList"
				/>
			</div>

			<template #footer>
				<el-button type="primary" @click="readUserListVisible = false">关闭</el-button>
			</template>
		</el-dialog>
	</cl-crud>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { useCrud, useTable, useUpsert, useSearch } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { useI18n } from 'vue-i18n';
import { useForm } from '@cool-vue/crud';
import { ElMessage, ElMessageBox } from 'element-plus';

defineOptions({
	name: 'notification-management'
});

const { t } = useI18n();
const { service } = useCool();

// 【数据源管理】
const departmentOptions = ref<{ label: string; value: number }[]>([]); // 用于下拉选择
const roleOptions = ref<{ label: string; value: number }[]>([]); // 角色列表
const userTreeData = ref<any[]>([]); // 树形用户列表（部门+用户）

// 获取部门名称（用于弹窗）
const getDepartmentName = (id: number | null) => {
	if (!id) return '-';
	const dept = departmentOptions.value.find(item => item.value === id);
	return dept ? dept.label : '-';
};

// 【核心逻辑】构建树形数据：部门 -> 用户
const buildUserTreeData = (departments: any[], users: any[]) => {
	const deptMap = new Map();

	// 1. 初始化部门节点
	departments.forEach(dept => {
		deptMap.set(dept.id, {
			value: dept.id,
			label: dept.name,
			children: [],
			isDept: true
		});
	});

	// 2. 将用户挂载到对应部门下
	users.forEach(user => {
		const userNode = {
			value: user.id,
			label: user.nickName || user.username || '未知用户',
			isLeaf: true
		};

		if (deptMap.has(user.departmentId)) {
			deptMap.get(user.departmentId).children.push(userNode);
		}
	});

	// 3. 将 Map 转为树形数组，并过滤掉没有用户的部门（可选）
	const tree = Array.from(deptMap.values()).filter(dept => dept.children.length > 0);
	return tree;
};

// 【接口调用】获取角色列表
const getRoleList = async () => {
	try {
		const res = await service.base.sys.role.page({ page: 1, size: 10000 });
		roleOptions.value = (res.list || []).map((item: any) => ({
			label: item.name,
			value: item.id
		}));
	} catch (err) {
		console.error('获取角色列表失败', err);
	}
};
// 【新增】从这一行开始复制
function buildTree(list: any[]) {
	const map = new Map();
	const tree: any[] = [];

	// 第一遍循环：创建映射
	list.forEach(item => {
		map.set(item.id, { ...item, children: [] });
	});

	// 第二遍循环：建立父子关系
	list.forEach(item => {
		const node = map.get(item.id);
		if (!item.parentId || item.parentId === 0) {
			tree.push(node);
		} else {
			const parent = map.get(item.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				// 异常处理：找不到父节点时挂在根节点
				tree.push(node);
			}
		}
	});
	return tree;
}

function transformTreeData(list: any[]) {
	return list.map(item => ({
		label: item.name,
		value: item.id,
		children:
			item.children && item.children.length > 0 ? transformTreeData(item.children) : undefined
	}));
}
const getDepartmentList = async () => {
	try {
		// 获取列表数据
		const res = await service.base.sys.department.list();

		// 调用上面定义的函数
		const treeData = buildTree(res || []);
		departmentOptions.value = transformTreeData(treeData);
	} catch (err) {
		console.error('获取部门列表失败', err);
	}
};

// 人员列表弹窗状态
const readUserListVisible = ref(false);
const userListLoading = ref(false);
const userDialogTitle = ref('');
const readUserList = ref<any[]>([]);
const currentNotificationId = ref<number | null>(null);
const currentIsReadStatus = ref<number | null>(null);
const readUserPageData = ref({
	pageNum: 1,
	pageSize: 10,
	total: 0
});

// cl-upsert (新增/编辑)
const Upsert = useUpsert({
	items: [
		{
			label: t('通知标题'),
			prop: 'title',
			component: {
				name: 'el-input',
				props: { clearable: true, placeholder: '请输入通知标题' }
			},
			span: 12,
			required: true
		},
		{
			label: t('通知类型'),
			prop: 'type',
			component: {
				name: 'el-select',
				options: [
					{ label: '公告', value: 0 },
					{ label: '提醒', value: 1 },
					{ label: '紧急', value: 2 },
					{ label: '系统更新', value: 3 }
				]
			},
			span: 12,
			required: true
		},
		{
			label: t('内容'),
			prop: 'content',
			component: {
				name: 'cl-editor-wang',
				props: { height: 300 }
			},
			span: 24,
			required: true
		},
		{
			label: t('附件'),
			prop: 'attachments',
			component: {
				name: 'cl-upload',
				props: {
					multiple: true,
					drag: true
				}
			},
			span: 24
		},
		{
			label: t('接收对象类型'),
			prop: 'targetType',
			span: 12,
			component: {
				name: 'el-radio-group',
				options: computed(() => {
					const baseOptions = [
						{ label: '全员', value: 0 },
						{ label: '指定部门', value: 1 },
						{ label: '指定人员', value: 3 }
					];
					if (roleOptions.value.length > 0) {
						baseOptions.splice(2, 0, { label: '指定角色', value: 2 });
					}
					return baseOptions;
				})
			},
			required: true
		},
		{
			label: t('指定部门'),
			prop: 'departmentIds',
			span: 12,
			component: {
				name: 'el-tree-select',
				props: {
					multiple: true,
					clearable: true,
					filterable: true,
					'show-checkbox': true,
					'collapse-tags': true,
					'collapse-tags-tooltip': true,
					placeholder: '请选择指定部门',
					props: {
						label: 'label',
						value: 'value',
						children: 'children'
					},
					data: departmentOptions
				},
				options: departmentOptions
			},
			hidden: ({ scope }) => {
				return scope.targetType !== 1;
			}
		},
		{
			label: t('指定角色'),
			prop: 'roleIds',
			span: 12,
			component: {
				name: 'el-select',
				props: {
					multiple: true,
					clearable: true,
					filterable: true,
					'collapse-tags': true,
					'collapse-tags-tooltip': true,
					'max-collapse-tags': 1,
					placeholder: '请选择指定角色'
				},
				options: roleOptions
			},
			hidden: ({ scope }) => {
				return scope.targetType !== 2;
			}
		},
		{
			label: t('指定人员'),
			prop: 'userIds',
			span: 12,
			component: {
				name: 'cl-user-select', // 【修改】使用 cl-user-select 组件
				ref: 'userSelectRef',
				props: {
					multiple: true,
					placeholder: '请选择指定人员'
				}
			},
			hidden: ({ scope }) => {
				return scope.targetType !== 3;
			}
		},
		{
			label: t('发布方式'),
			prop: 'publishType',
			component: {
				name: 'el-radio-group',
				options: [
					{ label: '立即发布', value: 0 },
					{ label: '定时发布', value: 1 }
				]
			},
			span: 12,
			required: true
		},
		{
			label: t('发布时间'),
			prop: 'publishTime',
			component: {
				name: 'el-date-picker',
				props: {
					type: 'datetime',
					placeholder: '选择日期时间',
					valueFormat: 'YYYY-MM-DD HH:mm:ss',
					disabledDate: (time: Date) => {
						return time.getTime() < Date.now() - 8.64e7;
					}
				}
			},
			span: 12,
			required: true,
			hidden: ({ scope }) => {
				return scope.publishType !== 1;
			}
		},
		{
			label: t('是否强提醒'),
			prop: 'forceRemind',
			component: {
				name: 'el-radio-group',
				options: [
					{ label: '否', value: 0 },
					{ label: '是', value: 1 }
				]
			},
			span: 12,
			required: true
		},
		{
			label: t('提醒间隔(分钟)'),
			prop: 'remindInterval',
			component: {
				name: 'el-input-number',
				props: { min: 1, placeholder: '请输入间隔', style: { width: '100%' } }
			},
			span: 12,
			required: true,
			hidden: ({ scope }) => {
				return scope.forceRemind !== 1;
			}
		}
	]
});

// 复制/编辑 表单
const CopyForm = useForm();
function copyNotification(notification, type) {
	service.base.sys.notice
		.info({ id: notification.id })
		.then(res => {
			// 提前保存 userIds，确保在 opened 钩子中能访问到
			const userIds = res.userIds || [];
			CopyForm.value?.open({
				title: '复制通知',
				width: '800px',
				items: [
					{
						label: t('通知标题'),
						prop: 'title',
						value: res.title,
						component: {
							name: 'el-input',
							props: { clearable: true, placeholder: '请输入通知标题' }
						},
						span: 12,
						required: true
					},
					{
						label: t('通知类型'),
						prop: 'type',
						value: res.type,
						component: {
							name: 'el-select',
							options: [
								{ label: '公告', value: 0 },
								{ label: '提醒', value: 1 },
								{ label: '紧急', value: 2 },
								{ label: '系统更新', value: 3 }
							]
						},
						span: 12,
						required: true
					},
					{
						label: t('内容'),
						prop: 'content',
						value: res.content,
						component: {
							name: 'cl-editor-wang',
							props: { height: 300 }
						},
						span: 24,
						required: true
					},
					{
						label: t('附件'),
						prop: 'attachments',
						value: res.attachments || [],
						component: {
							name: 'cl-upload',
							props: {
								multiple: true,
								drag: true
							}
						},
						span: 24
					},
					{
						label: t('接收对象类型'),
						prop: 'targetType',
						value: res.targetType,
						span: 12,
						component: {
							name: 'el-radio-group',
							options: computed(() => {
								const baseOptions = [
									{ label: '全员', value: 0 },
									{ label: '指定部门', value: 1 },
									{ label: '指定人员', value: 3 }
								];
								if (roleOptions.value.length > 0) {
									baseOptions.splice(2, 0, { label: '指定角色', value: 2 });
								}
								return baseOptions;
							})
						},
						required: true
					},

					{
						label: t('指定部门'),
						prop: 'departmentIds',
						value: res.departmentIds,
						span: 12,
						component: {
							name: 'el-tree-select',
							props: {
								multiple: true,
								clearable: true,
								filterable: true,
								'show-checkbox': true,
								'collapse-tags': true,
								'collapse-tags-tooltip': true,
								placeholder: '请选择指定部门',
								props: {
									label: 'label',
									value: 'value',
									children: 'children'
								},

								data: departmentOptions
							},
							options: departmentOptions
						},
						hidden: ({ scope }) => {
							return scope.targetType !== 1;
						}
					},
					{
						label: t('指定角色'),
						prop: 'roleIds',
						value: res.roleIds,
						span: 12,
						component: {
							name: 'el-select',
							props: {
								multiple: true,
								clearable: true,
								filterable: true,
								'collapse-tags': true,
								'collapse-tags-tooltip': true,
								'max-collapse-tags': 1,
								placeholder: '请选择指定角色'
							},
							options: roleOptions
						},
						hidden: ({ scope }) => {
							return scope.targetType !== 2;
						}
					},
					{
						label: t('指定人员'),
						prop: 'userIds',
						value: userIds,
						span: 12,
						component: {
							name: 'cl-user-select', // 【修改】复制表单同步使用 cl-user-select
							ref: 'userSelectRef',
							props: {
								multiple: true,
								placeholder: '请选择指定人员'
							}
						},
						hidden: ({ scope }) => {
							return scope.targetType !== 3;
						}
					},
					{
						label: t('发布方式'),
						prop: 'publishType',
						value: res.publishType || 0,
						component: {
							name: 'el-radio-group',
							options: [
								{ label: '立即发布', value: 0 },
								{ label: '定时发布', value: 1 }
							]
						},
						span: 12,
						required: true
					},
					{
						label: t('发布时间'),
						prop: 'publishTime',
						value: res.publishTime,
						component: {
							name: 'el-date-picker',
							props: {
								type: 'datetime',
								placeholder: '选择日期时间',
								valueFormat: 'YYYY-MM-DD HH:mm:ss',
								disabledDate: (time: Date) => {
									return time.getTime() < Date.now() - 8.64e7;
								}
							}
						},
						span: 12,
						required: true,
						hidden: ({ scope }) => {
							return scope.publishType !== 1;
						}
					},
					{
						label: t('是否强提醒'),
						prop: 'forceRemind',
						value: res.forceRemind,
						component: {
							name: 'el-radio-group',
							options: [
								{ label: '否', value: 0 },
								{ label: '是', value: 1 }
							]
						},
						span: 12,
						required: true
					},
					{
						label: t('提醒间隔(分钟)'),
						prop: 'remindInterval',
						value: res.remindInterval,
						component: {
							name: 'el-input-number',
							props: { min: 1, placeholder: '请输入间隔', style: { width: '100%' } }
						},
						span: 12,
						required: true,
						hidden: ({ scope }) => {
							return scope.forceRemind !== 1;
						}
					}
				],
				on: {
					submit(data, { close, done }) {
						if (type === 'copy') {
							service.base.sys.notice
								.add(data)
								.then(res => {
									ElMessage.success('复制成功');
									close();
									refresh();
								})
								.catch(err => {
									ElMessage.error(err.message || '复制失败');
									done();
								});
						} else {
							service.base.sys.notice
								.update({
									id: res.id,
									publishType: res.publishType,
									publisherId: res.publisherId,
									readCount: res.readCount,
									sendTime: res.sendTime,
									status: res.status,
									tenantId: res.tenantId,
									totalCount: res.totalCount,
									unreadCount: res.unreadCount,
									updateTime: res.updateTime,
									...data
								})
								.then(res => {
									ElMessage.success('修改成功');
									close();
									refresh();
								})
								.catch(err => {
									ElMessage.error(err.message || '修改失败');
									done();
								});
						}
					}
				}
			});
			setTimeout(() => {
				if (res.targetType === 3) {
					// 先点击组件框，触发打开（确保数据加载）
					const dom = document.querySelector('.cl-user-select') as any;
					if (dom) {
						dom.click();
					}
				}
			}, 500);
		})
		.catch(err => {
			ElMessage.error('获取详情失败');
			console.error(err);
		});
}

// 撤回
function recallNotification(notification) {
	ElMessageBox.confirm('确认要撤回这条通知吗？撤回后用户将无法查看。', '撤回确认', {
		confirmButtonText: '确认',
		cancelButtonText: '取消',
		type: 'warning'
	})
		.then(() => {
			service.base.sys.notice
				.recallNotification({ notificationId: notification.id })
				.then(res => {
					ElMessage.success('撤回成功');
					refresh();
				})
				.catch(err => {
					ElMessage.error(err.msg || err.message || '撤回失败');
				});
		})
		.catch(() => {
			ElMessage.info('已取消');
		});
}

// 重新发布
function republishNotification(notification) {
	ElMessageBox.confirm('确认要重新发布这条通知吗？', '重新发布确认', {
		confirmButtonText: '确认',
		cancelButtonText: '取消',
		type: 'warning'
	})
		.then(() => {
			service.base.sys.notice
				.republishNotification({ notificationId: notification.id })
				.then(res => {
					ElMessage.success('重新发布成功');
					refresh();
				})
				.catch(err => {
					ElMessage.error(err.msg || err.message || '重新发布失败');
				});
		})
		.catch(() => {
			ElMessage.info('已取消');
		});
}

// 点击人数事件处理
function handleShowUsers(row: any, isRead: number) {
	currentNotificationId.value = row.id;
	currentIsReadStatus.value = isRead;
	userDialogTitle.value = isRead === 1 ? '已读人员列表' : '未读人员列表';
	readUserPageData.value.pageNum = 1;
	readUserListVisible.value = true;
	fetchUserList();
}

// 获取人员列表数据
function fetchUserList() {
	if (!currentNotificationId.value) return;

	userListLoading.value = true;
	service.base.sys.notice
		.getReadUserList({
			page: readUserPageData.value.pageNum,
			size: readUserPageData.value.pageSize,
			notificationId: currentNotificationId.value,
			isRead: currentIsReadStatus.value
		})
		.then(res => {
			readUserList.value = res.list || [];
			readUserPageData.value.total = res.pagination?.total || 0;
		})
		.catch(err => {
			console.error(err);
			ElMessage.error('获取人员列表失败');
		})
		.finally(() => {
			userListLoading.value = false;
		});
}

// cl-table
const Table = useTable({
	contextMenu: [],
	columns: [
		{
			label: t('通知标题'),
			prop: 'title',
			minWidth: 300,
			fixed: 'left',
			showOverflowTooltip: true
		},
		{
			label: t('通知类型'),
			prop: 'type',
			minWidth: 90,
			dict: [
				{ label: '公告', value: 0, type: 'primary' },
				{ label: '提醒', value: 1, type: 'warning' },
				{ label: '紧急', value: 2, type: 'danger' },
				{ label: '系统更新', value: 3, type: 'info' }
			]
		},
		{
			label: t('通知状态'),
			prop: 'status',
			minWidth: 90,
			dict: [
				{ label: '草稿', value: 0, type: 'info' },
				{ label: '已发送', value: 1, type: 'success' },
				{ label: '已撤回', value: 2, type: 'danger' }
			]
		},
		{
			label: t('是否强提醒'),
			prop: 'forceRemind',
			minWidth: 90,
			dict: [
				{ label: '否', value: 0, type: 'primary' },
				{ label: '是', value: 1, type: 'danger' }
			]
		},
		{
			label: t('已读人数'),
			prop: 'readCount',
			minWidth: 100
		},
		{
			label: t('未读人数'),
			prop: 'unreadCount',
			minWidth: 100
		},
		{
			label: t('发布人'),
			prop: 'publisherName',
			minWidth: 120
		},
		{
			label: t('发出时间'),
			prop: 'sendTime',
			minWidth: 160
		},
		{
			type: 'op',
			width: 230,
			buttons: ['slot-menu', 'slot-copy', 'delete']
		}
	]
});

// cl-search
const Search = useSearch({
	resetBtn: true,
	items: [
		{
			label: t('通知标题'),
			prop: 'title',
			component: {
				name: 'el-input',
				props: {
					placeholder: '请输入通知标题',
					clearable: true
				}
			}
		},
		{
			label: t('通知类型'),
			prop: 'type',
			component: {
				name: 'el-select',
				options: [
					{ label: '公告', value: 0 },
					{ label: '提醒', value: 1 },
					{ label: '紧急', value: 2 },
					{ label: '系统更新', value: 3 }
				],
				props: {
					clearable: true
				}
			}
		},
		{
			label: t('通知状态'),
			prop: 'status',
			component: {
				name: 'el-select',
				options: [
					{ label: '草稿', value: 0 },
					{ label: '已发送', value: 1 },
					{ label: '已撤回', value: 2 }
				],
				props: {
					clearable: true
				}
			}
		}
	]
});

// cl-crud
const Crud = useCrud(
	{
		service: service.base.sys.notice
	},
	app => {
		app.refresh();
	}
);

function refresh(params?: any) {
	Crud.value?.refresh(params);
}

// 初始化数据
onMounted(() => {
	getDepartmentList();
	getRoleList();
});
</script>

<style scoped lang="scss">
/* 可点击数字样式 */
.clickable-count {
	cursor: pointer;
	color: #409eff;
	transition: color 0.2s;

	&:hover {
		color: #66b1ff;
		text-decoration: underline;
	}
}
</style>
