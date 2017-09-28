define(['vue', 'store'],
function(V, store) {
    'use strict';
    // Category 类
    function Category(pid, level, title) {
        this.addTime = Date.now();
        this.cid = 'cid_' + this.addTime;
        this.pid = pid || null;
        this.level = level || 0; // 记录目录层级
        this.title = title || '';
        this.childCatList = [];
        this.childTodoList = [];
    }

    // Todo 类
    function Todo(cid, title, content, expire) {
        this.addTime = Date.now();
        this.tid = 'tid_' + this.addTime;
        this.cid = cid;
        this.level = 0; // 紧急程度
        this.title = title;
        this.content = content;
        this.isFinish = false;
        this.expireTime = expire;
    }

    // 格式化日期
    var getFormatDate = function(timestamp, spliter) {
        if (!timestamp) {
            return '';
        }

        spliter = spliter || '-';
        var date = new Date(+timestamp);
        var y = date.getFullYear(),
            m = date.getMonth() + 1,
            d = date.getDate();
        return [y,
                m < 10 ? '0' + m : m,
                d < 10 ? '0' + d : d
            ].join(spliter);
    };

    var UI = {
        prompt: function(title, placeholder) {
            return window.prompt(title, placeholder);
        },
        alert: function(msg) {
            return window.alert(msg);
        },
        confirm: function(msg) {
            return window.confirm(msg);
        },
        showInfo: function(msg) {
            window.alert(msg);
        }
    };

    var _topKey = 'topCatId'; // 顶级分类id
    var _topCatId = store.data(_topKey); //获取顶级分类id

    if (!_topCatId) { // 如果还没有分类

        // 首先新建顶级分类
        var topCat = new Category(null, 0, '顶级分类');
        //将时间戳-1是为了防止程序运行太快导致默认分类和顶级分类id重复了(都是时间戳取的)
        topCat.addTime = topCat.addTime - 1;
        topCat.cid = 'cid_' + topCat.addTime;

        _topCatId = topCat.cid;
        store.data(_topKey, _topCatId);

        // 再新建一个默认分类并保存
        var firstCat = new Category(_topCatId, topCat.level + 1, '默认分类');
        store.data(firstCat.cid, firstCat);

        // 将默认分类添加到顶级分类中
        topCat.childCatList.push(firstCat.cid);
        store.data(_topCatId, topCat);

        topCat = null;
        firstCat = null;
    }


    // event bus
    var bus = new V();

    var state = {
        currentCatId:  '',
        currentTodoId: '',
        currentStatu:  '',
        allTasks: 0,
        currentPageIndex: 0,
    };

    var CategoryListView = {
        template: `
            <div>
                <ul>
                    <li>
                        <a  class="item" id="show-all-todo"
                            :class="{selected: isSelect('show-all-todo')}"
                            @click="handleSelect('show-all-todo')">
                            <span>所有任务</span>
                            <span class="td-count">({{ allTasks }})</span>
                        </a>
                    </li>
                    <li>
                        <a  class="item" id="show-all-cat"
                            :class="{selected: isSelect('show-all-cat')}"
                            @click="handleSelect('show-all-cat')" >
                            <span>分类列表</span>
                        </a>
                        <div id="category-list">
                            <category-list :parent="topCat"></category-list>
                        </div>
                    </li>

                </ul>
                <footer class="footer">
                    <button class="btn-add" @click="addCategory">新增分类</button>
                </footer>
            </div>
        `,

        data: function() {
            return {
                instate: state,
                topCat: store.data(_topCatId),
            };
        },

        computed: {
            allTasks: function() {
                return this.instate.allTasks;
            }
        },

        methods: {
            handleSelect: function(id) {
                this.instate.currentCatId = id;

                if (id === 'show-all-todo') { //移动端翻页
                    this.instate.currentPageIndex++;
                }
            },
            isSelect: function(id) {
                return this.instate.currentCatId === id;
            },
            addCategory: function() {
                if (this.instate.currentCatId === 'show-all-todo') {
                    UI.alert('请选择具体分类进行添加！');
                    return;
                }

                var pid = this.instate.currentCatId === 'show-all-cat' ? this.topCat.cid : this.instate.currentCatId;

                // 通过消息中心发送通知，添加基于pid的子分类
                bus.$emit('add-category', pid);
            },
        }
    };

    V.component('category-list', {

        template: `
            <ul>
                <category-item
                    v-for="cate in list"
                        :item="cate"
                        :key="cate.cid"
                        @remove-cat="removeCat">
                </category-item>
            </ul>
        `,

        props: {
            'parent': {
                type: Object,
                required: true,
            }
        },
        watch: {
            'parent': {
                handler: function() {
                    store.data(this.parent.cid, this.parent);
                },
                deep: true
            }
        },
        data: function() {
            return {
                list: [],
                instate: state,
            };
        },
        created: function() {
            this.initList();

            // 监听消息中心通知，但是会触发所有列表组件的事件调用
            bus.$on('add-category', this.addCategory);

            // 接收到添加和删除任务的操作，分类也要进行处理
            bus.$on('added-todo', this.addedTodo);
            bus.$on('delete-todo', this.deleteTodo);
        },
        methods: {
            initList: function() {
                var cids = this.parent.childCatList;
                if (!cids.length) {
                    return;
                }

                // 初始化默认选中列表第一个
                if (!this.instate.currentCatId) {
                    this.instate.currentCatId = cids[0];
                }

                var newList = [];
                cids.forEach(function(cid) {
                    newList.push(store.data(cid));
                });

                this.list = newList;
            },
            removeCat: function(deleteItem) {
                if (!UI.confirm('确定删除 <'+ deleteItem.title +'> 分类及其所有子分类和任务吗？')) {
                    return;
                }

                // 从列表中移出分类
                this.list.splice(this.list.indexOf(deleteItem), 1); //会触发destroy
                // 从父分类中删除，//会触发watcher自动保存parent
                this.parent.childCatList.splice(this.parent.childCatList.indexOf(deleteItem.cid), 1);

                // 根据删除分类和上次已选择分类的节点关系更新数据
                var lastItem = store.data(this.instate.currentCatId);
                if (lastItem && lastItem.addTime >= deleteItem.addTime) { //用建立分类的时间戳大小来判断祖孙关系
                    this.instate.currentCatId = this.list[0] ? this.list[0].cid : deleteItem.pid; //重新选中同级第一个或者上级
                }
            },

            hasSameName: function(name) {
                for (var i = 0, len = this.list.length; i < len; i += 1) {
                    if (this.list[i].title === name) {
                        return true;
                    }
                }
                return false;
            },
            getValidName: function() {
                var namePrefix = '未命名分类';

                var tmp = '';
                for (var i = 0, len = this.list.length; i < len; i += 1) {
                    tmp = namePrefix + (i + 1);
                    if (!this.hasSameName(tmp)) {
                        return tmp;
                    }
                }
                tmp = namePrefix + (i + 1);

                return tmp;
            },
            addCategory: function(pid) {
                // 所有列表组件的事件都会被调用，所以我们只处理当前列表父分类id和传入pid相等的情况
                if (pid !== this.parent.cid) {
                    return;
                }

                var name = this.getValidName();
                var msg = '请输入创建的子分类名称：';
                var isValid = false;

                while (!isValid) {
                    name = (UI.prompt(msg, name));

                    if (name === null) {
                        break;
                    } else if (name.trim() === '') {
                        name = '';
                        isValid = false;
                        msg = '注意：名称不能为空！';
                    } else if (/[^\w\u4E00-\u9FA5]+/g.test(name)) {
                        isValid = false;
                        msg = '注意：名称只能包含汉字、字母、数字、下划线！';
                    } else if (this.hasSameName(name)) {
                        isValid = false;
                        msg = '注意：该分类下已使用过相同名称！';
                    } else {
                        isValid = true;
                    }
                } //while

                if (isValid) {
                    var cate = new Category(pid, this.parent.level + 1, name);

                    this.list.push(cate); //数据更新会触发更新dom
                    store.data(cate.cid, cate); //保存

                    this.parent.childCatList.push(cate.cid); //会触发watcher自动保存parent

                    this.$emit('add-category'); //告知父分类做其他处理
                } //if
            },
            addedTodo: function(item) {
                if (item.cid !== this.parent.cid) {
                    return;
                }
                this.parent.childTodoList.push(item.tid);
                this.instate.allTasks += 1;
            },
            deleteTodo: function(item) {
                if (item.cid !== this.parent.cid) {
                    return;
                }
                this.parent.childTodoList.splice(this.parent.childTodoList.indexOf(item.tid), 1);
                this.instate.allTasks -= 1;
            }
        } //methods
    });

    V.component('category-item', {

        template: `
            <li>
                <a  :id="item.cid" class="item item-cat icon-folder"
                    :class="{selected: isSelect(), 'folder-opened': isOpen}"
                    :style="{paddingLeft: paddingLeft + 'px'}"
                    @click="handleSelect">
                    <span>{{ item.title }}</span>
                    <span class="td-count">({{ item.childTodoList.length }})</span>
                    <span class="act-del" @click.stop="removeCat"></span>
                </a>
                <category-list
                    v-show="isOpen"
                    :parent="item"
                    @add-category="addChildCat">
                </category-list>
            </li>
        `,

        props: ['item'],

        data: function() {
            return {
                isOpen: false,
                instate: state,
                incrPadding: 20,
            };
        },

        created: function() { //创建分类列表的时候顺便统计了总任务数量
            this.instate.allTasks += this.item.childTodoList.length;
        },

        destroyed: function() { //从列表删除元素时会更新dom，该元素被destroyed，然后全部子元素destroyed
            store.remove(this.item.cid); //从storage里面删除分类
            store.remove(this.item.childTodoList); //从storage里面删除任务
            this.instate.allTasks -= this.item.childTodoList.length; //调整总任务数量
        },

        computed: {
            paddingLeft: function() {
                return this.item.level * this.incrPadding;
            }
        },

        methods: {
            handleSelect: function() {
                this.isOpen = !this.isOpen;
                this.instate.currentCatId = this.item.cid;
                this.instate.currentPageIndex++; //移动端翻页
            },

            // 可以用计算属性，但为了表示和handleSelect一起的动作变化就放到一起了
            isSelect: function() {
                return this.instate.currentCatId === this.item.cid;
            },

            // 确认删除分类并发消息通知父组件
            removeCat: function() {
                this.$emit('remove-cat', this.item);
            },

            // 添加顶级分类时不会触发，从子组件子分类接收到添加成功后的消息，并将文件夹设置打开状态
            addChildCat: function() {
                this.isOpen = true;
            }
        }
    });

    var TodoListView = {
        template: `
            <div>
                <div class="header">
                    <div class="btns">
                        <div class="btns-inner" >
                            <button id="statu-all"  :class="{selected: isSelect('statu-all')}" @click.stop="switchStatu('statu-all')">&nbsp;所有&nbsp;</button>
                            <button id="statu-not"  :class="{selected: isSelect('statu-not')}" @click.stop="switchStatu('statu-not')">未完成</button>
                            <button id="statu-done" :class="{selected: isSelect('statu-done')}" @click.stop="switchStatu('statu-done')">已完成</button>
                        </div>
                    </div>
                </div>
                <todo-list id="todo-list" :todoList="filterTodos"></todo-list>
                <footer class="footer">
                    <button class="btn-add" @click.stop="addTodo">新增任务</button>
                </footer>
            </div>
        `,

        data: function() {
            return {
                todos: [],
                instate: state,
            };
        },
        created: function() {
            this.initTodoList();
            this.instate.currentStatu = 'statu-all';

            // 接收到添加和删除任务的操作，分类也要进行处理
            bus.$on('added-todo', this.addedTodo);
            bus.$on('delete-todo', this.deleteTodo);
        },
        watch: {
            'instate.currentCatId': function() {
                this.initTodoList();
            }
        },

        computed: {
            filterTodos: function() {
                var filteredTodos = [];
                switch (this.instate.currentStatu) {
                    case 'statu-not':
                        filteredTodos = this.todos.filter(function(todo) {
                            return !todo.isFinish;
                        });
                        break;
                    case 'statu-done':
                        filteredTodos = this.todos.filter(function(todo) {
                            return todo.isFinish;
                        });
                        break;
                    case 'statu-all':
                        filteredTodos = this.todos;
                        break;
                }

                return filteredTodos;
            },
        },

        methods: {
            isSelect: function(statu) {
                return this.instate.currentStatu === statu;
            },
            switchStatu: function(statuStr) {
                this.instate.currentStatu = statuStr;
            },
            addTodo: function() {
                if (this.instate.currentCatId.indexOf('cid_') < 0) {
                    UI.alert('请选择具体分类进行添加！');
                } else {
                    this.instate.currentPageIndex++; //移动端翻页
                    bus.$emit('add-todo');
                }
            },
            addedTodo: function(todo) {
                this.todos.push(todo);
            },
            deleteTodo: function(item) {
                this.todos.splice(this.todos.indexOf(item), 1);
            },

            initTodoList: function() {
                var todoIds = [];
                var catId = this.instate.currentCatId;
                switch (catId) {
                    case 'show-all-cat':
                        break;
                    case 'show-all-todo':
                        todoIds = this.getAllTodoList();
                        break;
                    default:
                        todoIds = store.data(catId).childTodoList;
                }
                // from localStorage
                var todoList = [];
                todoIds.forEach(function(tid) {
                    todoList.push(store.data(tid));
                });

                this.todos = todoList;
            },

            getAllTodoList: function() {
                var ids = [];
                var walkCategory = function(cid) {
                    var item = store.data(cid);
                    if (!item) {
                        return;
                    }

                    // 由回调函数或者收集数据
                    ids = ids.concat(item.childTodoList);

                    // 遍历子分类列表
                    var childIds = item.childCatList;
                    for (var i = 0, len = childIds.length; i < len; i += 1) {
                        walkCategory(childIds[i]); //递归
                    }
                };
                walkCategory(_topCatId);

                return ids;
            },
        } //methods
    }; //TodoListView

    V.component('todo-list', {
        template: `
            <div>
                <ul>
                    <li v-for="date in dateKeys">
                        <time>{{ date }}</time>
                        <ul>
                            <todo-item v-for="todo in archivedTodos[date]" :item="todo" :key="todo.tid"></todo-item>
                        </ul>
                    </li>
                </ul>
            </div>
        `,
        props: ['todoList'],
        watch: {
            'todoList': function() {
                this.initArchiveTodoList();
            }
        },
        created: function() {
            this.initArchiveTodoList();
        },
        mounted: function() {
            this.selectFirst();
        },
        updated: function() {
            this.selectFirst();
        },
        data: function() {
            return {
                instate: state,
                archivedTodos: {},
            };
        },
        computed: {
            dateKeys: function() {
                var keys = Object.keys(this.archivedTodos);
                keys.sort(function(a, b) {
                    if (a > b) {
                        return -1;
                    } else if (a < b) {
                        return 1;
                    } else {
                        return 0;
                    }
                });

                return keys;
            }
        },
        methods: {
            initArchiveTodoList: function() {
                var obj = {};
                var todoList = this.todoList;

                for (var i = 0, len = todoList.length; i < len; i += 1) {
                    var date = getFormatDate(todoList[i].expireTime);
                    if (!obj[date]) {
                        obj[date] = [];
                    }
                    obj[date].push(todoList[i]);
                }

                this.archivedTodos = obj;
            },
            selectFirst: function() { //选中第一个
                var list = this.archivedTodos[this.dateKeys[0]];
                var first = list && list[0];
                this.instate.currentTodoId = first && first.tid || '';

                bus.$emit('show-item', first);
            }
        }
    }); //todo-list

    V.component('todo-item', {
        template: `
            <li>
                <a  :id="item.tid" class="item item-todo"
                    :class="{ selected: isSelect(), 'done-item': item.isFinish }"
                    @click.stop="handleSelect">
                    <span>{{ item.title }}</span>
                    <span class="act-done" @click.stop="toggleDone"></span>
                    <span class="act-del"  @click.stop="deleteTodo"></span>
                </a>
            </li>
        `,

        props: ['item'],
        watch: {
            'item': {
                handler: function() {
                    store.data(this.item.tid, this.item);
                },
                deep: true
            },
            'instate.currentTodoId': function() {
                if (this.instate.currentTodoId !== this.item.tid) {
                    return;
                }

                bus.$emit('show-item', this.item);
            }
        },
        data: function() {
            return {
                instate: state
            };
        },
        methods: {
            handleSelect: function() {
                this.instate.currentTodoId = this.item.tid;
                this.instate.currentPageIndex++; //移动端翻页
            },
            isSelect: function() {
                return this.instate.currentTodoId === this.item.tid;
            },
            toggleDone: function() {
                this.item.isFinish = !this.item.isFinish;
            },
            deleteTodo: function() {
                if (!UI.confirm('你确定删除该任务吗？')) {
                    return;
                }

                store.remove(this.item.tid);
                bus.$emit('delete-todo', this.item);
            }
        }
    }); //todo-item

    var TodoDetailView = {
        template: `
            <div>
                <div id="detail-wrap">
                    <div v-if="isShow">
                        <header class="td-head">
                            <label>标题：</label>
                            <span class="title">{{ title }}</span>
                        </header>
                        <div class="td-date">
                            <label>日期：</label>
                            <time>{{ expireDate }}</time>
                        </div>
                        <div class="td-desc">
                            <label>描述：</label>
                            <div class="content">{{ content }}</div>
                        </div>
                    </div>
                    <div v-else>
                        <header class="td-head">
                            <label for="todo-title">标题：</label>
                            <input type="text" id="todo-title" maxlength="30" v-model.trim="title"  placeholder="请输入标题">
                            <span class="warning">< 30</span>
                        </header>
                        <div class="td-date">
                            <label for="todo-expire">日期：</label>
                            <input type="date" id="todo-expire" v-model="expireDate" placeholder="请输入日期如 2017-01-02">
                            <span class="warning">2000-01-02</span>
                        </div>
                        <div class="td-desc">
                            <label for="todo-content">描述：</label>
                            <textarea id="todo-content" placeholder="请输入任务内容" v-model="content"></textarea>
                        </div>
                    </div>
                </div>
                <footer class="footer">
                    <div v-if="isShow" class="btns" id="edit-btns">
                        <div class="btns-inner">
                            <button class="edit" @click.stop="editTodo">编辑</button>
                        </div>
                    </div>
                    <div v-else class="btns" id="save-btns">
                        <div class="btns-inner">
                            <button class="cancel" @click.stop="cancelEdit">取消</button>
                            <button class="save" @click.stop="saveTodo">保存</button>
                        </div>
                    </div>
                </footer>
            </div>
        `,
        data: function() {
            return {
                isShow: true,
                editAction: '',
                preTodo: '',
                instate: state,
                title: '',
                content: '',
                expireTime: '',
            };
        },
        watch: {
            //切换各种状态时要从编辑回到显示状态
            'instate.currentCatId': function() {
                this.isShow = true;
            },
            'instate.currentStatu': function() {
                this.isShow = true;
            },
            'instate.currentTodoId': function() {
                this.isShow = true;
            },
        },
        created: function() {
            bus.$on('show-item', this.showItem);
            bus.$on('add-todo', this.addTodo);
        },
        computed: {
            expireDate: {
                get: function() {
                    return getFormatDate(this.expireTime);
                },
                set: function(newDate) {
                    this.expireTime = (new Date(newDate)).getTime();
                }
            }
        },
        methods: {
            setData: function(title, content, expireTime) {
                this.title = this.htmlDecode(title || '');
                this.content = this.htmlDecode(content || '');
                this.expireTime = expireTime || '';
            },
            showItem: function(todo) {
                this.preTodo = todo; //保存原始数据引用
                if (todo) {
                    this.setData(todo.title, todo.content, todo.expireTime);
                } else {
                    this.setData();
                }
            },
            addTodo: function() {
                this.setData('未命名任务', '', Date.now());
                this.isShow = false;
                this.editAction = 'add';
            },
            editTodo: function() {
                this.isShow = false;
                this.editAction = 'edit';
            },
            cancelEdit: function() {
                //移动端翻页
                if (this.editAction === 'add') { //取消添加就返回列表
                    this.instate.currentPageIndex--;
                }

                this.isShow = true;
                this.editAction = '';
                this.setData(this.preTodo.title, this.preTodo.content, this.preTodo.expireTime);
            },
            saveTodo: function() {
                if (!this.editAction) {
                    return;
                }
                if (!this.title.length || this.title.length > 30) {
                    UI.alert('任务名称不能为空，也不能超过30字！');
                    return;
                }
                if (!this.expireDate.length) {
                    UI.alert('过期时间不能为空！');
                    return;
                }
                if (!this.content.length || this.content.length > 800) {
                    UI.alert('任务内容不能为空，也不能超过800字！');
                    return;
                }

                this.title = this.htmlEncode(this.title);
                this.content = this.htmlEncode(this.content);

                switch(this.editAction) {
                    case 'add':
                        var todo = new Todo(this.instate.currentCatId, this.title, this.content, this.expireTime);
                        store.data(todo.tid, todo);

                        bus.$emit('added-todo', todo);
                        break;
                    case 'edit':
                        // 更新preTodo数据会自动触发保存操作
                        this.preTodo.title = this.title;
                        this.preTodo.expireTime = this.expireTime;
                        this.preTodo.content = this.content;
                        break;
                }
                this.isShow = true;
                this.editAction = '';
            },
            htmlEncode: function (str) { // html转义
                return str.replace(/&/g,  '&amp;')
                          .replace(/</g,  '&lt;')
                          .replace(/>/g,  '&gt;')
                          .replace(/ /g,  '&nbsp;')
                          .replace(/\'/g, '&#39;')
                          .replace(/\"/g, '&quot;');
            },
            htmlDecode: function(str) { // 解析html转义
                return str.replace(/&amp;/g,  '&')
                          .replace(/&lt;/g,   '<')
                          .replace(/&gt;/g,   '>')
                          .replace(/&nbsp;/g, ' ')
                          .replace(/&#39;/g,  '\'')
                          .replace(/&quot;/g, '\"');
            }
        }
    };

    var vm = new V({
        template: `
            <div>
                <header id="header">
                    <h1>GTD T<span>◎◎</span>L</h1>
                    <a  href="javascript:void(0);" class="icon-back"
                        :class="{hidden: isHidden}"
                        @click="goBack">&lt;</a>
                </header>
                <main class="main">
                    <category-list-view id="menu" class="page" :class="computePageClass('menu')"></category-list-view>
                    <todo-list-view id="list" class="page" :class="computePageClass('list')"></todo-list-view>
                    <todo-detail-view id="detail" class="page" :class="computePageClass('detail')"></todo-detail-view>
                </main>
            </div>
        `,
        data: function() {
            return {
                instate: state,
                pages: ['menu', 'list', 'detail'],
            };
        },
        computed: {
            isHidden: function() {
                return this.instate.currentPageIndex < 1;
            },
        },
        methods: {
            pageActive: function(page) {
                return this.pages.indexOf(page) === this.instate.currentPageIndex;
            },
            pagePrev: function(page) {
                return this.pages.indexOf(page) < this.instate.currentPageIndex;
            },
            pageNext: function(page) {
                return this.pages.indexOf(page) > this.instate.currentPageIndex;
            },
            computePageClass: function(pageId) {
                return {
                    'page-active': this.pageActive(pageId),
                    'page-prev': this.pagePrev(pageId),
                    'page-next': this.pageNext(pageId),
                };
            },
            goBack: function() {
                this.instate.currentPageIndex--; //移动端翻页
            }
        },
        components: {
            'category-list-view': CategoryListView,
            'todo-list-view': TodoListView,
            'todo-detail-view': TodoDetailView,
        },
    });

    return {
        init: function() {
            vm.$mount('#app');
        }
    };
});