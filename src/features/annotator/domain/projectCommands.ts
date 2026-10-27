import type {Annotation,AnnotationPatch,Project} from './types';
export type ProjectCommand =
 | {type:'annotation.add';annotation:Annotation}
 | {type:'annotation.move';annotation:Annotation}
 | {type:'annotation.update';id:string;patch:AnnotationPatch}
 | {type:'annotation.remove';id:string}
 | {type:'annotations.clear'}
 | {type:'title.set';title:string};
export function applyProjectCommand(project:Project,command:ProjectCommand):Project {
  switch(command.type){
    case 'title.set':return {...project,title:command.title};
    case 'annotation.add':return {...project,items:[...project.items,command.annotation],nextNumber:command.annotation.type==='point'?project.nextNumber+1:project.nextNumber};
    case 'annotation.remove':return {...project,items:project.items.filter(item=>item.id!==command.id)};
    case 'annotations.clear':return {...project,items:[],nextNumber:1};
    case 'annotation.move':return {...project,items:project.items.map(item=>item.id===command.annotation.id?command.annotation:item)};
    case 'annotation.update':return {...project,items:project.items.map(item=>item.id===command.id?{...item,...command.patch}:item)};
  }
}
