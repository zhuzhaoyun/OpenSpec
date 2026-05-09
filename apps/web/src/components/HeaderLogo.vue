<template>
    <div class="logo" @click="goToHome">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="8" width="24" height="20" stroke="#0078D4" stroke-width="2" fill="none"/>
            <line x1="4" y1="14" x2="28" y2="14" stroke="#0078D4" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="28" stroke="#0078D4" stroke-width="2"/>
        </svg>
        <span class="logo-text">AIAD 智绘设计</span>
        <!-- <img src="@/assets/logo-new.png" alt="建工数科" height="32" /> -->
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToHome = () => {
  router.push('/')
}
</script>

<style>
.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.logo:hover {
  opacity: 0.8;
}

.logo-text {
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>