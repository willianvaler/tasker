// As versões do Android Gradle Plugin e do Kotlin são as do React Native do app (já no cache)
plugins {
  id("com.android.application") version "8.12.0" apply false
  id("org.jetbrains.kotlin.android") version "2.1.20" apply false
  id("org.jetbrains.kotlin.plugin.compose") version "2.1.20" apply false
}
