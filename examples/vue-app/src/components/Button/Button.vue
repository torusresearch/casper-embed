<script lang="ts" setup>
import { Button } from "@toruslabs/vue-components";

withDefaults(
  defineProps<{
    label?: string;
    classes?: string;
    pill?: boolean;
    block?: boolean;
    small?: boolean;
  }>(),
  {
    label: "",
    pill: true,
    block: true,
    small: false,
  }
);

const emits = defineEmits(["onClick"]);
</script>

<template>
  <div :class="{ block: block }">
    <label class="btn-label" v-if="label">{{ label }}</label>
    <Button variant="secondary" :size="small ? 'xs' : 'md'" :class="['btn-secondary', classes]" :pill="pill" :block="block" @click="emits('onClick')">
      <slot> </slot>
    </Button>
  </div>
</template>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
@import "Button.css";
</style>
