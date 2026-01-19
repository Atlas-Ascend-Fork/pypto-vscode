import { createApp } from 'vue';
import App from './App.vue';
import Skeleton from 'vue-devui/skeleton';
import 'vue-devui/skeleton/style.css';
import Message from 'vue-devui/message';
import 'vue-devui/message/style.css';
import Tooltip from 'vue-devui/tooltip';
import 'vue-devui/tooltip/style.css';
import Icon from 'vue-devui/icon';
import 'vue-devui/icon/style.css';
import Breadcrumb from 'vue-devui/breadcrumb';
import 'vue-devui/breadcrumb/style.css';
import Dropdown from 'vue-devui/dropdown';
import 'vue-devui/dropdown/style.css';
import CategorySearch from 'vue-devui/category-search';
import 'vue-devui/category-search/style.css';
import Tabs from 'vue-devui/tabs';
import 'vue-devui/tabs/style.css';
import Drawer from 'vue-devui/drawer';
import 'vue-devui/drawer/style.css';
import Alert from 'vue-devui/alert';
import 'vue-devui/alert/style.css';
import Search from 'vue-devui/search';
import 'vue-devui/search/style.css';
import Input from 'vue-devui/input';
import 'vue-devui/input/style.css';
import Slider from 'vue-devui/slider';
import 'vue-devui/slider/style.css';
import Button from 'vue-devui/button';
import 'vue-devui/button/style.css';
import Badge from 'vue-devui/badge';
import 'vue-devui/badge/style.css';
import Select from 'vue-devui/select';
import 'vue-devui/select/style.css';
import Checkbox from 'vue-devui/checkbox';
import 'vue-devui/checkbox/style.css';
import InputNumber from 'vue-devui/input-number';
import 'vue-devui/input-number/style.css';
import Loading from 'vue-devui/loading';
import 'vue-devui/loading/style.css';
import Table from 'vue-devui/table';
import 'vue-devui/table/style.css';
import Tree from 'vue-devui/tree';
import 'vue-devui/tree/style.css';
import Progress from 'vue-devui/progress';
import 'vue-devui/progress/style.css';
import Modal from 'vue-devui/modal';
import 'vue-devui/modal/style.css';
import i18n from './i18n';
import EventBus from './service/event-bus';
import './style.scss';
import Form from 'vue-devui/form';
import 'vue-devui/form/style.css';
import Textarea from 'vue-devui/textarea';
import 'vue-devui/textarea/style.css';
import Grid from 'vue-devui/grid';
import 'vue-devui/grid/style.css';
import Popover from 'vue-devui/popover';
import 'vue-devui/popover/style.css';
import CodeReview from 'vue-devui/code-review';
import 'vue-devui/code-review/style.css';
import Switch from 'vue-devui/switch';
import 'vue-devui/switch/style.css';
import Radio from 'vue-devui/radio';
import 'vue-devui/radio/style.css';
import Collapse from 'vue-devui/collapse';
import 'vue-devui/collapse/style.css';
import Pagination from 'vue-devui/pagination';
import 'vue-devui/pagination/style.css';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { ExtensionConnector } from './core/connector';

// 通知extension页面加载
const viewConnector = new ExtensionConnector('editorView');
viewConnector.send(null);

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

EventBus.init();

createApp(App)
  .use(Tooltip)
  .use(Icon)
  .use(Breadcrumb)
  .use(Dropdown)
  .use(CategorySearch)
  .use(Tabs)
  .use(Alert)
  .use(Search)
  .use(Input)
  .use(Slider)
  .use(Select)
  .use(Button)
  .use(Badge)
  .use(Message)
  .use(Checkbox)
  .use(InputNumber)
  .use(Table)
  .use(i18n)
  .use(Drawer)
  .use(Tree)
  .use(Progress)
  .use(Modal)
  .use(Skeleton)
  .use(Form)
  .use(Textarea)
  .use(Grid)
  .use(Popover)
  .use(Loading)
  .use(CodeReview)
  .use(Switch)
  .use(Radio)
  .use(Collapse)
  .use(Pagination)
  .mount('#app');
