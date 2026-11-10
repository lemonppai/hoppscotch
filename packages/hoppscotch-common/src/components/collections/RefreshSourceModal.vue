<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('collection.refresh_from_source')"
    @close="hideModal"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <p class="text-secondaryLight">
          {{ t("collection.connect_openapi_source_description") }}
        </p>
        <HoppSmartInput
          v-model="sourceURL"
          placeholder=" "
          input-styles="floating-input"
          :label="t('collection.connect_openapi_source_label')"
          @submit="submit"
        />
        <p class="text-secondaryLight">
          {{ t("collection.connect_openapi_source_placeholder") }}
        </p>
      </div>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('collection.refresh_from_source')"
          :loading="loading"
          outline
          @click="submit"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"

const t = useI18n()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    show: boolean
    loading?: boolean
    /** Prefill — used when a source exists but the user wants to repoint it. */
    initialURL?: string
  }>(),
  { show: false, loading: false, initialURL: "" }
)

const emit = defineEmits<{
  (e: "submit", url: string): void
  (e: "hide-modal"): void
}>()

const sourceURL = ref("")

watch(
  () => props.initialURL,
  (url) => {
    sourceURL.value = url ?? ""
  },
  { immediate: true }
)

const submit = () => {
  if (props.loading) return

  const url = sourceURL.value.trim()

  if (!/^https?:\/\/\S+$/i.test(url)) {
    toast.error(t("collection.connect_openapi_source_invalid").toString())
    return
  }

  emit("submit", url)
}

const hideModal = () => {
  emit("hide-modal")
}
</script>
