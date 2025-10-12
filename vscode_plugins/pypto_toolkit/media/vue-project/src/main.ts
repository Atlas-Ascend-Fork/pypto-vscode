import { createApp } from 'vue';
import App from './App.vue';

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
import i18n from './i18n';
import EventBus from './service/event-bus';
import './style.scss';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { initExtensionQuery } from './core/query';

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

initExtensionQuery();
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
  .use(i18n)
  .mount('#app');
