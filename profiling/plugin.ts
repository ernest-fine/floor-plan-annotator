import type {Plugin} from 'vite';
export default function profilePlugin():Plugin {
 const probes:Record<string,[string,string]>={
  '/features/annotator/pages/AnnotatorPage.tsx':['app-renders','appRenders'],
  '/features/annotator/components/map/MapCanvas.tsx':['map-renders','mapRenders'],
  '/features/annotator/components/map/AnnotationLayer.tsx':['shape-renders','shapeRenders'],
  '/features/annotator/hooks/useMapViewport.ts':['resize-callbacks','resizeCallbacks'],
  '/features/annotator/components/panels/AnnotationList.tsx':['list-renders','listRenders'],
 };
 const observed=new Set<string>();
 return {name:'local-performance-probes',enforce:'pre',buildStart(){observed.clear();},transform(code,id){
  const path=Object.keys(probes).find(path=>id.endsWith(path));if(!path)return;
  const [marker,count]=probes[path],token='// @profile:'+marker;
  if(!code.includes(token))throw new Error('Missing profile probe: '+path);
  observed.add(path);return {code:code.replace(token,`globalThis.__annotatorProfile?.count('${count}');`),map:null};
 },generateBundle(){for(const path of Object.keys(probes))if(!observed.has(path))throw new Error('Profile owner was not instrumented: '+path);}};
}
