import type {Annotation,AnnotationPatch} from '../domain/types';
import type {Notify} from '@/shared/types/notice';
import type {ProjectDocument} from './useProjectDocument';
import type useEditorState from './useEditorState';
export default function useAnnotationActions(document:ProjectDocument,ui:ReturnType<typeof useEditorState>,notify:Notify){
  const item=document.project.items.find(item=>item.id===ui.selectedId);
  function add(annotation:Annotation){if(document.getProject().items.length>=3000){notify('Annotation limit: 3000.',true);return;}document.execute({type:'annotation.add',annotation});ui.added(annotation);}
  function update(patch:AnnotationPatch){if(item)document.execute({type:'annotation.update',id:item.id,patch});}
  function remove(){if(!item)return;document.execute({type:'annotation.remove',id:item.id});ui.select(null);}
  function clear(){if(confirm('Clear all annotations and readings? You can undo this.')){document.execute({type:'annotations.clear'});ui.setSelectedId(null);}}
  return {item,add,update,remove,clear,move:(annotation:Annotation)=>document.execute({type:'annotation.move',annotation}),title:(title:string)=>document.execute({type:'title.set',title})};
}
