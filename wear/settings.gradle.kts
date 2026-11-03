// App do relógio Wear OS (D287): projeto Gradle à parte do android/ (que o Expo gera e apaga a cada
// build). Mesmo pacote e mesma chave de assinatura do app do celular: sem isso a Data Layer não liga
// os dois. Compilar: npm run wear (scripts/build-wear.sh)
pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
  }
}
rootProject.name = "questlist-wear"
include(":app")
