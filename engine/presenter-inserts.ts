import {z} from 'zod';

export const presenterInsertsSchema=z.object({
 brand:z.string().trim().min(1),handle:z.string().trim().min(1),handleAt:z.number().nonnegative(),
 inserts:z.array(z.object({
  kind:z.enum(['message','viewers']),heading:z.string().trim().min(1),
  start:z.number().nonnegative(),end:z.number().positive()
 }).strict()).min(1)
}).strict().superRefine((v,ctx)=>{
 for(const [i,s] of v.inserts.entries()){
  if(s.end<=s.start||(i>0&&s.start<v.inserts[i-1].end))ctx.addIssue({code:'custom',message:'Inserts must be positive, chronological and separate.'});
 }
});
