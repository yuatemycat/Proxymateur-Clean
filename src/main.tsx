import React from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import './i18n'; // Import i18n config
import "./App.css";

import { isTauri } from "./utils/env";
import { invoke } from "@tauri-apps/api/core";

// 启动时显式调用 Rust 命令保证主窗口显示与置顶聚焦
if (isTauri()) {
  invoke("show_main_window").catch(console.error);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />

  </React.StrictMode>,
);
