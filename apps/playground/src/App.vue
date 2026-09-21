<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app">
    <header class="app__header">
      <strong>Luckysheet3 MVP</strong>
      <nav>
        <RouterLink to="/">原版对比</RouterLink>
        <RouterLink to="/compat">Compat API</RouterLink>
      </nav>
    </header>
    <main class="app__main">
      <div class="app__view">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
}
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: system-ui, sans-serif;
}
.app__header {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e5e5;
  background: #111;
  color: #fff;
}
.app__header a {
  color: #9ecbff;
  margin-right: 12px;
  text-decoration: none;
}
.app__header a.router-link-active {
  color: #fff;
  font-weight: 600;
}
.app__main {
  flex: 1;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.app__view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
