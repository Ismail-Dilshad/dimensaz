import type {Config,Scene} from '../engine/schema.js';
import type {ReferenceIndex,ReferenceMatch} from './model.js';
import {search} from './search.js';
const roleTerms:Record<Scene['role'],string>={
 hook:'hook typography kinetic reveal',question:'question typography emphasis',problem:'problem contrast typography',
 explanation:'explanation text transitions',comparison:'comparison card saas',benefit:'benefit saas card',
 statistic:'statistic counter numbers',product:'product object',brand:'brand cinematic',cta:'cta call action'
};
export function findGuidance(index:ReferenceIndex,role:Scene['role'],c:Config):ReferenceMatch|undefined{
 if(!c.useReferences)return;
 const candidates=search(index,c.referenceQuery||(roleTerms[role]+' '+c.theme),{reviewedOnly:true,limit:8});
 // A generic filename/category overlap is not enough to drive a scene.
 return candidates.find(m=>m.technique&&m.technique.confidence>=.7&&m.technique.roles.includes(role));
}
