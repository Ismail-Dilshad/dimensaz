import {afterAll} from 'vitest';
import {cleanupTestArtifacts} from '../src/engine/test-artifacts.js';
afterAll(async()=>{await cleanupTestArtifacts();});
