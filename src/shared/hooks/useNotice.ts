import {useCallback,useEffect,useRef,useState} from 'react';
import type {Notify} from '../types/notice';
export default function useNotice(){
  const [notice,setNotice]=useState<{message:string;error:boolean}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const notify:Notify=useCallback((message,error=false)=>{clearTimeout(timer.current);setNotice({message,error});timer.current=setTimeout(()=>setNotice(null),error?8000:3000);},[]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return {notice,notify};
}
