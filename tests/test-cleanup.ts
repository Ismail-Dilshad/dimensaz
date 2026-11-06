import {afterAll} from 'vitest';
import {cleanupTestArtifacts} from '../engine/test-artifacts.js';
afterAll(async()=>{await cleanupTestArtifacts();});
