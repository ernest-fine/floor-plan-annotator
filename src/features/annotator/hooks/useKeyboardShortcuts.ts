import {useEffect} from 'react';
import type {Tool} from '../types/editor';
interface Shortcuts {undo():void;redo():void;remove():void;escape():void;chooseTool(tool:Tool):void;canRemove:boolean}
export default function useKeyboardShortcuts(actions:Shortcuts){
  useEffect(()=>{
    const keyDown=(event:KeyboardEvent)=>{
      if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable=true]'))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();(event.shiftKey?actions.redo:actions.undo)();return;}
      if((event.key==='Delete'||event.key==='Backspace')&&actions.canRemove){event.preventDefault();actions.remove();return;}
      if(event.key==='Escape'){actions.escape();return;}
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey){const shortcuts:Partial<Record<string,Tool>>={v:'select',d:'point',t:'text',a:'arrow',p:'pen'};const next=shortcuts[event.key.toLowerCase()];if(next)actions.chooseTool(next);}
    };
    document.addEventListener('keydown',keyDown);return()=>document.removeEventListener('keydown',keyDown);
  },[actions]);
}
