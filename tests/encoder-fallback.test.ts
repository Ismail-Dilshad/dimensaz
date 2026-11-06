import {it,expect,vi} from 'vitest';
vi.mock('../src/renderer/ffmpeg-encoder.js',()=>({ffmpeg:'test-ffmpeg',run:vi.fn().mockRejectedValue(new Error('No NVENC driver'))}));
import {encoderConfig} from '../src/renderer/performance.js';import {run} from '../src/renderer/ffmpeg-encoder.js';import {defaults} from '../src/engine/config.js';
it('falls back to software on a failed real-encoder probe without altering quality settings',async()=>{const c=await defaults({codec:'h264_nvenc',crf:19});const result=await encoderConfig(c);expect(result.codec).toBe('libx264');expect(result.fallback).toContain('probe failed');expect(result.args).toContain('19');expect(run).toHaveBeenCalledWith('test-ffmpeg',expect.arrayContaining(['h264_nvenc']));});
it('software and auto do not require a GPU probe',async()=>{vi.mocked(run).mockClear();expect((await encoderConfig(await defaults({codec:'auto'}))).codec).toBe('libx264');expect(run).not.toHaveBeenCalled();});
