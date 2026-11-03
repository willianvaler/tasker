package com.willianvaler.questlist.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/** O celular mudou o treino: o Android acorda este serviço mesmo com o app do relógio fechado */
class WorkoutListenerService : WearableListenerService() {
  override fun onDataChanged(events: DataEventBuffer) {
    for (event in events) {
      if (event.dataItem.uri.path != WorkoutState.PATH) continue
      val state =
        if (event.type == DataEvent.TYPE_DELETED) null
        else WorkoutState.from(DataMapItem.fromDataItem(event.dataItem).dataMap)
      WorkoutStore.set(this, state)
    }
  }
}
