import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, useColorScheme, AppState, Dimensions, PanResponder, AccessibilityInfo } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false })
})

const fmt = ms => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function App(){
  const scheme = useColorScheme()
  const [workMin,setWorkMin] = useState(25)
  const [breakMin,setBreakMin] = useState(5)
  const [soundEnabled,setSoundEnabled] = useState(false)
  const [vibrationEnabled,setVibrationEnabled] = useState(true)
  const [mode,setMode] = useState('work')
  const [running,setRunning] = useState(false)
  const [targetMs,setTargetMs] = useState(0)
  const [remainingMs,setRemainingMs] = useState(workMin*60*1000)
  const [sessionCount,setSessionCount] = useState(0)
  const appState = useRef(AppState.currentState)
  const intervalRef = useRef(null)
  const width = Dimensions.get('window').width

  useEffect(()=>{(async()=>{
    try{
      const s = await AsyncStorage.getItem('pomodoro_settings')
      if(s){
        const v = JSON.parse(s)
        setWorkMin(v.workMin ?? workMin)
        setBreakMin(v.breakMin ?? breakMin)
        setSoundEnabled(!!v.soundEnabled)
        setVibrationEnabled(v.vibrationEnabled!==false)
      }
      const c = await AsyncStorage.getItem('pomodoro_count')
      if(c) setSessionCount(Number(c)||0)
    }catch{}
  })()},[])

  useEffect(()=>{(async()=>{
    const payload = {workMin,breakMin,soundEnabled,vibrationEnabled}
    await AsyncStorage.setItem('pomodoro_settings',JSON.stringify(payload))
  })()},[workMin,breakMin,soundEnabled,vibrationEnabled])

  useEffect(()=>{
    const sub = AppState.addEventListener('change',next => {
      appState.current = next
      if(running){
        const r = Math.max(0, targetMs - Date.now())
        setRemainingMs(r)
      }
    })
    return ()=>sub.remove()
  },[running,targetMs])

  useEffect(()=>{
    if(intervalRef.current) clearInterval(intervalRef.current)
    if(running){
      intervalRef.current = setInterval(()=>{
        const r = Math.max(0,targetMs - Date.now())
        setRemainingMs(r)
        if(r<=0){
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setRunning(false)
          setRemainingMs(0)
          onComplete()
        }
      },500)
    }
    return ()=>{if(intervalRef.current) clearInterval(intervalRef.current)}
  },[running,targetMs])

  useEffect(()=>{(async()=>{
    const { status } = await Notifications.getPermissionsAsync()
    if(status !== 'granted'){
      await Notifications.requestPermissionsAsync()
    }
    if(Platform.OS==='android'){
      await Notifications.setNotificationChannelAsync('pomodoro',{
        name:'Pomodoro',importance:Notifications.AndroidImportance.DEFAULT
      })
    }
  })()},[])

  const durationMs = useMemo(()=> (mode==='work'?workMin:breakMin)*60*1000, [mode,workMin,breakMin])

  useEffect(()=>{ if(!running) setRemainingMs(durationMs) },[mode,workMin,breakMin])

  const scheduleEndNotification = async (whenMs) => {
    await Notifications.cancelAllScheduledNotificationsAsync()
    await Notifications.scheduleNotificationAsync({
      content:{ title: mode==='work'?'Work complete':'Break complete', body: mode==='work'?'Time for a break':'Back to work', sound: soundEnabled ? 'default' : undefined },
      trigger:{ channelId:'pomodoro', date: new Date(whenMs) }
    })
  }

  const start = async ()=>{
    const end = Date.now() + remainingMs
    setTargetMs(end)
    setRunning(true)
    await scheduleEndNotification(end)
    if(vibrationEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }
  const pause = async ()=>{
    setRunning(false)
    if(vibrationEnabled) Haptics.selectionAsync()
    await Notifications.cancelAllScheduledNotificationsAsync()
  }
  const reset = async ()=>{
    setRunning(false)
    setRemainingMs(durationMs)
    await Notifications.cancelAllScheduledNotificationsAsync()
    if(vibrationEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }
  const onComplete = async ()=>{
    const nextMode = mode==='work'?'break':'work'
    if(mode==='work'){ const c = sessionCount+1; setSessionCount(c); await AsyncStorage.setItem('pomodoro_count',String(c)) }
    setMode(nextMode)
    setRemainingMs((nextMode==='work'?workMin:breakMin)*60*1000)
  }

  const toggleModeSwipe = dir => {
    const next = dir==='left'? (mode==='work'?'break':'work') : (mode==='work'?'break':'work')
    setMode(next)
    if(!running) setRemainingMs((next==='work'?workMin:breakMin)*60*1000)
  }

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onPanResponderRelease:(_,g)=>{
      if(Math.abs(g.dx)>60){ toggleModeSwipe(g.dx<0?'left':'right') }
    }
  })).current

  const bigSize = width>380?128:104

  return (
    <View style={[styles.container, scheme==='dark'?styles.dark:styles.light]} {...pan.panHandlers}>
      <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={mode==='work'?'Work timer':'Break timer'}>
        <Text style={[styles.timerText,{fontSize:bigSize}]} allowFontScaling>
          {fmt(remainingMs)}
        </Text>
        <Text style={styles.modeLabel}>{mode==='work'?'Work':'Break'}</Text>
      </View>
      <View style={styles.bottomBar}>
        {!running ? (
          <Pressable style={[styles.btn,styles.primary]} onPress={start} accessibilityRole="button" accessibilityLabel="Start" onLongPress={reset}>
            <Text style={styles.btnText}>Start</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.btn,styles.secondary]} onPress={pause} accessibilityRole="button" accessibilityLabel="Pause" onLongPress={reset}>
            <Text style={styles.btnText}>Pause</Text>
          </Pressable>
        )}
        <Pressable style={[styles.btn,styles.ghost]} onPress={reset} accessibilityRole="button" accessibilityLabel="Reset">
          <Text style={styles.btnText}>Reset</Text>
        </Pressable>
      </View>
      <View style={styles.settings}>
        <Pressable style={styles.setting} onPress={()=>setWorkMin(Math.max(1,workMin+1))}><Text style={styles.settingText}>Work {workMin}m ▲</Text></Pressable>
        <Pressable style={styles.setting} onPress={()=>setWorkMin(Math.max(1,workMin-1))}><Text style={styles.settingText}>Work {workMin}m ▼</Text></Pressable>
        <Pressable style={styles.setting} onPress={()=>setBreakMin(Math.max(1,breakMin+1))}><Text style={styles.settingText}>Break {breakMin}m ▲</Text></Pressable>
        <Pressable style={styles.setting} onPress={()=>setBreakMin(Math.max(1,breakMin-1))}><Text style={styles.settingText}>Break {breakMin}m ▼</Text></Pressable>
        <Pressable style={styles.setting} onPress={()=>setSoundEnabled(!soundEnabled)}><Text style={styles.settingText}>{soundEnabled?'Sound: On':'Sound: Off'}</Text></Pressable>
        <Pressable style={styles.setting} onPress={()=>setVibrationEnabled(!vibrationEnabled)}><Text style={styles.settingText}>{vibrationEnabled?'Vibration: On':'Vibration: Off'}</Text></Pressable>
        <Text style={styles.settingSmall}>Sessions {sessionCount}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:{flex:1,justifyContent:'space-between',alignItems:'center',paddingTop:40,paddingBottom:24},
  light:{backgroundColor:'#f8fafc'},
  dark:{backgroundColor:'#0a0b10'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  timerText:{fontVariant:['tabular-nums'],fontWeight:'700',color:'#0b1020'},
  modeLabel:{marginTop:8,color:'#64748b'},
  bottomBar:{width:'100%',flexDirection:'row',justifyContent:'space-around',paddingHorizontal:16},
  btn:{flex:1,marginHorizontal:8,paddingVertical:16,borderRadius:14,alignItems:'center'},
  primary:{backgroundColor:'#7c3aed'},
  secondary:{backgroundColor:'#06b6d4'},
  ghost:{backgroundColor:'#e5e7eb'},
  btnText:{color:'#ffffff',fontWeight:'700'},
  settings:{width:'100%',flexWrap:'wrap',flexDirection:'row',justifyContent:'center',gap:8,paddingHorizontal:12},
  setting:{paddingHorizontal:10,paddingVertical:8,borderRadius:10,backgroundColor:'#e5e7eb'},
  settingText:{color:'#0b1020'},
  settingSmall:{marginTop:8,color:'#64748b',textAlign:'center',width:'100%'}
})
