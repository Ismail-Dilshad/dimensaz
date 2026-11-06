import {animationNames} from '../animations/animation-registry.js';
import type {ReferenceMatch} from '../motion-library/model.js';
import type {Scene} from './schema.js';
export function classify(text:string,index:number,total:number):Scene['role'] {
 if(/(?:پەیوەندی|ئێستا|نامە|call|contact|order now)/iu.test(text)&&index===total-1)return 'cta';
 if(/[?؟]/u.test(text))return 'question';
 if(/(?:بەراورد|بەڵام|versus|compare|\bvs\b)/iu.test(text))return 'comparison';
 if(/\d|[٠-٩۰-۹]/u.test(text))return 'statistic';
 if(/(?:کێشە|ناتوان|problem|cannot)/iu.test(text))return 'problem';
 if(/(?:کاڵا|بەرهەم|product)/iu.test(text))return 'product';
 if(/(?:دەرفەت|زیاتر|benefit|increase)/iu.test(text))return 'benefit';
 return index===0?'hook':'explanation';
}
export function selectMotion(role:Scene['role'],reference?:ReferenceMatch):string {
 const proposed=reference?.technique?.presets.find(p=>animationNames.includes(p as any));
 if(proposed)return proposed;
 return ({hook:'spring-pop',question:'bounce-up',problem:'mask-reveal',explanation:'sentence-build',comparison:'comparison-layout',benefit:'saas-feature-card',statistic:'statistics-counter',product:'spring-entrance',brand:'glow-pulse',cta:'cta-reveal'})[role];
}
