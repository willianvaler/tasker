plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("org.jetbrains.kotlin.plugin.compose")
}

android {
  namespace = "com.willianvaler.questlist.wear"
  compileSdk = 36

  defaultConfig {
    // O mesmo applicationId do celular (app.json): a Data Layer só liga apps com o mesmo pacote
    applicationId = "com.willianvaler.questlist"
    // Wear OS 3 (API 30) em diante: Galaxy Watch4 e mais novos
    minSdk = 30
    targetSdk = 34
    versionCode = (project.findProperty("wearVersionCode") as String?)?.toInt() ?: 1
    versionName = (project.findProperty("wearVersionName") as String?) ?: "1.0.0"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
  buildFeatures {
    compose = true
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.activity:activity-compose:1.9.3")
  implementation("androidx.wear.compose:compose-material:1.4.1")
  implementation("androidx.wear.compose:compose-foundation:1.4.1")
  implementation("androidx.wear:wear:1.3.0")
  implementation("androidx.wear:wear-ongoing:1.0.0")
  implementation("com.google.android.gms:play-services-wearable:19.0.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
}
