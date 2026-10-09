#!/usr/bin/env python3
"""Render the Report Scout walkthrough from real screenshots and measured results.

Requires Pillow, macOS `say`, and ffmpeg. No network access or browser automation.
The images are actual browser captures; the incident cards are explanatory graphics.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
WIDTH, HEIGHT = 1280, 720
BG = '#101b16'
PANEL = '#17271e'
INK = '#edf0df'
MUTED = '#abbca7'
SAGE = '#c9d8ae'
LINE = '#394b3a'
AMBER = '#e2bb80'
SERIF = '/System/Library/Fonts/Supplemental/Georgia.ttf'
SANS = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
MONO = '/System/Library/Fonts/Menlo.ttc'


def font(size: int, face: str = SANS):
    return ImageFont.truetype(face, size)


def wrapped(draw, text, typeface, width):
    lines = []
    for paragraph in text.split('\n'):
        current = ''
        for word in paragraph.split():
            trial = f'{current} {word}'.strip()
            if current and draw.textlength(trial, font=typeface) > width:
                lines.append(current)
                current = word
            else:
                current = trial
        lines.append(current)
    return lines


def block(draw, text, x, y, size=22, width=300, fill=INK, face=SANS, leading=1.35):
    typeface = font(size, face)
    lines = wrapped(draw, text, typeface, width)
    for line in lines:
        draw.text((x, y), line, fill=fill, font=typeface)
        y += round(size * leading)
    return y


def run(command):
    subprocess.run([str(part) for part in command], check=True)


def find_ffmpeg(explicit):
    candidates = [explicit, os.environ.get('FFMPEG_BINARY'), shutil.which('ffmpeg'),
                  '/tmp/fly-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1']
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise SystemExit('Pass --ffmpeg /absolute/path/to/ffmpeg.') from error


def audio_duration(ffmpeg, audio):
    result = subprocess.run([ffmpeg, '-hide_banner', '-i', str(audio)], capture_output=True, text=True)
    match = re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)', result.stderr)
    if not match:
        raise RuntimeError(f'Cannot read audio duration: {audio}')
    hours, minutes, seconds = map(float, match.groups())
    return hours * 3600 + minutes * 60 + seconds


def fly(draw, center, radius=55, color=SAGE):
    x, y = center
    draw.ellipse((x-radius*1.5, y-radius*1.5, x+radius*1.5, y+radius*1.5), outline=LINE, width=1)
    draw.ellipse((x-11, y-13, x+11, y+39), outline=color, width=2)
    draw.ellipse((x-12, y-38, x+12, y-14), outline=color, width=2)
    draw.ellipse((x-58, y-51, x-12, y+4), outline=color, width=2)
    draw.ellipse((x+12, y-51, x+58, y+4), outline=color, width=2)
    for offset in [0, 12, 24]:
        draw.line((x-10, y+offset, x-34, y+offset+16, x-43, y+offset+32), fill=color, width=1)
        draw.line((x+10, y+offset, x+34, y+offset+16, x+43, y+offset+32), fill=color, width=1)
    draw.line((x-7, y-36, x-19, y-52), fill=color, width=1)
    draw.line((x+7, y-36, x+19, y-52), fill=color, width=1)


def add_screenshot(image, draw, source, crop, highlight=None):
    original = Image.open(source).convert('RGB')
    # Coordinates refer to the recorded 1453×993 viewport, scaled if necessary.
    factor_x, factor_y = original.width / 1453, original.height / 993
    scaled_crop = tuple(round(value * (factor_x if index % 2 == 0 else factor_y)) for index, value in enumerate(crop))
    shot = original.crop(scaled_crop)
    box = (398, 117, 1240, 597)
    draw.rounded_rectangle(box, radius=12, fill='#0b130f', outline=LINE, width=1)
    ratio = min((box[2]-box[0]-16) / shot.width, (box[3]-box[1]-16) / shot.height)
    shot = shot.resize((round(shot.width*ratio), round(shot.height*ratio)), Image.Resampling.LANCZOS)
    x, y = box[0]+(box[2]-box[0]-shot.width)//2, box[1]+(box[3]-box[1]-shot.height)//2
    image.paste(shot, (x, y))
    if highlight:
        rect = tuple(round((value * (factor_x if i % 2 == 0 else factor_y) - scaled_crop[i % 2]) * ratio + (x if i % 2 == 0 else y)) for i, value in enumerate(highlight))
        draw.rounded_rectangle(rect, radius=5, outline=AMBER, width=2)
    draw.text((408, 97), 'ACTUAL APP CAPTURE', font=font(11, MONO), fill=MUTED)


def background(scene, index, total):
    image = Image.new('RGB', (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    # Fine-grained editorial background, deliberately distinct from the UI capture.
    for x in range(16, WIDTH, 34):
        for y in range(14, 619, 34):
            draw.point((x, y), fill='#1e2b21')
    draw.text((42, 31), 'THE OBSERVATORY  /  FLY FIELD GUIDE', font=font(14, MONO), fill=SAGE)
    draw.text((1000, 32), 'SYNTHETIC DEMONSTRATION', font=font(12, MONO), fill=MUTED)
    draw.line((42, 68, 1238, 68), fill=LINE, width=1)
    draw.text((43, 99), scene['label'], font=font(13, MONO), fill=AMBER)
    title_y = block(draw, scene['title'], 40, 140, size=39, width=325, face=SERIF, leading=1.17)
    content_y = title_y + 26
    for bullet in scene['points']:
        draw.ellipse((43, content_y+8, 47, content_y+12), fill=SAGE)
        content_y = block(draw, bullet, 60, content_y, size=19, width=300, fill=MUTED, leading=1.3)+17
    draw.text((43, 574), f'{index + 1:02d} / {total:02d}', font=font(12, MONO), fill=MUTED)
    # Every scene carries its complete narration as readable open captions.
    draw.rectangle((0, 622, WIDTH, HEIGHT), fill='#080f0b')
    draw.line((42, 622, 1238, 622), fill=LINE, width=1)
    captions = wrapped(draw, scene['narration'], font(20), 1178)
    caption_y = 640 + max(0, (2-len(captions))*12)
    for caption in captions:
        draw.text((51, caption_y), caption, font=font(20), fill=INK)
        caption_y += 27
    segment = 1196 / total
    for i in range(total):
        draw.rounded_rectangle((42+i*segment, 711, 42+(i+1)*segment-5, 715), radius=2, fill=SAGE if i<=index else LINE)
    return image, draw


def render_scene(scene, index, total, captures, results, target):
    image, draw = background(scene, index, total)
    if scene.get('screenshot'):
        add_screenshot(image, draw, captures / scene['screenshot'], scene.get('crop', (274, 135, 1387, 845)), scene.get('highlight'))
    elif scene['kind'] == 'intro':
        draw.rounded_rectangle((398,117,1240,597), radius=12, fill=PANEL, outline=LINE)
        fly(draw, (1115,205), 53)
        block(draw, 'The nightly sync failed.\nWhere is the evidence?', 430,153, size=32,width=610,face=SERIF)
        incidents = [('02:00','connector-sync','AUTH_EXPIRED'),('02:02','search-index','AUTH_EXPIRED'),('02:04','daily-report','TOKEN_REFRESH_FAILED')]
        for i,(time,job,error) in enumerate(incidents):
            yy=302+i*74
            draw.rounded_rectangle((431,yy,1207,yy+60),radius=6,fill=BG,outline=LINE)
            draw.text((449,yy+20),time,font=font(17,MONO),fill=AMBER)
            draw.text((538,yy+20),job,font=font(19),fill=INK)
            draw.text((867,yy+20),error,font=font(15,MONO),fill=MUTED)
        draw.text((431,558),'20 AUG 2026 · UTC · FICTIONAL INCIDENTS',font=font(12,MONO),fill=MUTED)
    elif scene['kind'] == 'hypothesis':
        draw.rounded_rectangle((398,117,1240,597),radius=12,fill=PANEL,outline=LINE)
        draw.text((433,151),'EVIDENCE → HYPOTHESIS → NEXT CHECK',font=font(13,MONO),fill=AMBER)
        block(draw,'One shared credential.\nThree interrupted jobs.',433,189,size=34,width=740,face=SERIF)
        rows=[('OBSERVED','Two AUTH_EXPIRED records; one TOKEN_REFRESH_FAILED.'),('HYPOTHESIS','A shared credential or refresh path blocks dependent jobs.'),('VERIFY','Inspect token expiry and refresh result; confirm the jobs use that credential.')]
        for i,(label,text) in enumerate(rows):
            yy=310+i*82
            draw.line((433,yy-12,1205,yy-12),fill=LINE)
            draw.text((433,yy),label,font=font(12,MONO),fill=AMBER)
            block(draw,text,566,yy-1,size=20,width=632,fill=INK)
        draw.text((433,575),'HUMAN INTERPRETATION · ROOT CAUSE NOT PROVEN',font=font(11,MONO),fill=MUTED)
    elif scene['kind'] == 'metrics':
        add_screenshot(image,draw,captures/'05-test.jpg',(274,135,1387,845))
    image.save(target)


def make_scenes(results):
    return [
        {'kind':'intro','label':'WHY / FAILURE TRIAGE','title':'Teach a fly\nto find\nthe evidence.','points':['A practical field guide.','Find useful files. Extract facts. Investigate with citations.'],'narration':'When workspace automations fail, evidence gets scattered. Train a small fly to find useful files and collect facts for a failure report.'},
        {'screenshot':'01-create.jpg','label':'01 / CREATE','title':'Give your\nscout a job.','points':['Open Report Scout.','Name it Failure Scout.','Click Create a scout.'],'narration':'Open Report Scout and create a scout named Failure Scout. Its learned skill is choosing which file to read next.'},
        {'screenshot':'02-data.jpg','crop':(274,112,1387,826),'label':'02 / DATA','title':'Import the\npractice\ncollection.','points':['Data → Import dataset JSON.','Use space-failures.dataset.json.','12 training · 4 validation · 6 test workspaces.'],'narration':'In Data, import the supplied space-failures dataset. Training, validation, and test workspaces are separate. Every incident in this collection is synthetic.'},
        {'screenshot':'03-teach.jpg','label':'03 / TEACH','title':'Demonstrate\na useful\nnext read.','points':['Start a demonstration.','Select current evidence files.','Your choices become examples.'],'narration':'In Teach, start a demonstration. Select current incident evidence files. Each click teaches a useful next read; the collection also supplies automatic teaching examples.'},
        {'screenshot':'04-train.jpg','crop':(274,267,1387,892),'label':'04 / TRAIN','title':'Turn examples\ninto a\nreading policy.','points':['60 epochs','Learning rate 0.05','Seed 17 → Train the scout'],'narration':'Set sixty epochs, learning rate zero point zero five, and seed seventeen. Train the scout and watch its measured loss curve.'},
        {'screenshot':'05-test.jpg','label':'05 / TEST','title':'Test with\nunseen\nworkspaces.','points':['Evaluate held-out cases.','4 reads from 12 files.','Compare learned, filename, and random.'],'narration':'Evaluate held-out cases. Compare useful-file coverage with filename matching and random reads, using the same four-read budget. These results apply to this synthetic collection.'},
        {'screenshot':'06-report.jpg','crop':(720,310,1380,800),'label':'06 / INSPECT','title':'Follow the\nfacts back\nto their files.','points':['Run Test · nightly workspace sync.','Read the records and citations.','Partial report: 8 files remain unread.'],'narration':'Run the nightly workspace sync test. Its cited records show two authentication-expired errors and one token-refresh failure. Eight files remain unread, so the report is partial.'},
        {'kind':'hypothesis','label':'USE CASE / UNDERSTAND A FAILURE','title':'Turn evidence\ninto a better\nnext question.','points':['Look for a common dependency.','Verify the credential and refresh result.','Evidence supports a hypothesis, not proof.'],'narration':'The shared credential suggests a connection problem. Check token expiry, refresh results, and which jobs share that credential before claiming a root cause.'},
        {'screenshot':'07-export.jpg','crop':(279,270,1376,890),'label':'07 / EXPORT','title':'Keep the\ntrained skill.','points':['Export skill artifact.','Portable JSON: policy + provenance.','xo-space adapter is the next phase.'],'narration':'After evaluation, export the trained JSON. It contains the policy and provenance. Running this fly inside xo-space will require the adapter we plan to build next.'},
    ]


def timestamp(seconds, separator='.'):
    milliseconds=round(seconds*1000)
    hours,milliseconds=divmod(milliseconds,3600000)
    minutes,milliseconds=divmod(milliseconds,60000)
    seconds,milliseconds=divmod(milliseconds,1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}{separator}{milliseconds:03}'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures',type=Path,default=Path('/tmp/fly-walkthrough'))
    parser.add_argument('--results',type=Path,default=ROOT/'public/fly/examples/space-failures-results.json')
    parser.add_argument('--output',type=Path,default=ROOT/'public/fly/tutorial')
    parser.add_argument('--work',type=Path,default=Path('/tmp/fly-walkthrough/render'))
    parser.add_argument('--ffmpeg')
    parser.add_argument('--voice',default='Samantha')
    parser.add_argument('--rate',type=int,default=178)
    parser.add_argument('--images-only',action='store_true')
    args=parser.parse_args()
    results=json.loads(args.results.read_text())
    scenes=make_scenes(results)
    required={scene['screenshot'] for scene in scenes if scene.get('screenshot')}
    missing=[name for name in sorted(required) if not (args.captures/name).is_file()]
    if missing:
        raise SystemExit('Missing actual UI screenshots: '+', '.join(missing))
    args.output.mkdir(parents=True,exist_ok=True)
    args.work.mkdir(parents=True,exist_ok=True)
    ffmpeg=find_ffmpeg(args.ffmpeg)
    segments=[]
    timings=[]
    elapsed=0.0
    for index,scene in enumerate(scenes):
        stem=args.work/f'{index+1:02}'
        png=stem.with_suffix('.png')
        render_scene(scene,index,len(scenes),args.captures,results,png)
        if index==0:
            Image.open(png).save(args.output/'train-a-failure-scout-poster.jpg',quality=94)
        if args.images_only:
            continue
        speech=stem.with_suffix('.txt')
        speech.write_text(scene['narration'])
        audio=stem.with_suffix('.aiff')
        run(['/usr/bin/say','-v',args.voice,'-r',args.rate,'-f',speech,'-o',audio])
        duration=round(audio_duration(ffmpeg,audio)+0.85,3)
        video=stem.with_suffix('.mp4')
        run([ffmpeg,'-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',png,'-i',audio,'-t',duration,
             '-vf',f'fade=t=in:st=0:d=0.18,fade=t=out:st={max(0,duration-0.18):.3f}:d=0.18',
             '-af','adelay=250|250,apad','-c:v','libx264','-preset','medium','-tune','stillimage','-crf','19','-pix_fmt','yuv420p',
             '-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-movflags','+faststart',video])
        segments.append(video)
        timings.append((elapsed,elapsed+duration,scene))
        elapsed+=duration
        print(f'Rendered {index+1}/{len(scenes)}: {scene["label"]} ({duration:.1f}s)',flush=True)
    if args.images_only:
        print(f'Scene images: {args.work}')
        return
    concat=args.work/'segments.txt'
    concat.write_text('\n'.join("file '"+str(path).replace("'","'\\''")+"'" for path in segments)+'\n')
    output=args.output/'train-a-failure-scout.mp4'
    run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',output])
    vtt=['WEBVTT','']
    srt=[]
    transcript=['# Train a failure scout','',
        f'Video duration: {elapsed:.1f} seconds. Narration is synthesized using the macOS {args.voice} voice.',
        'All incidents and data are synthetic. App screenshots show an actual local training run. The video’s incident diagram and interpretation are explanatory graphics, not generated app output.',
        '', 'Dataset: [space-failures.dataset.json](../examples/space-failures.dataset.json).',
        'Measured results: [space-failures-results.json](../examples/space-failures-results.json).',
        'The filenames deliberately include misleading query matches to exercise the learned ranking policy. The filename baseline score is specific to this constructed collection and does not establish broad real-world superiority.',
        'The recorded browser run includes three human teaching choices. Its scores match the independently generated audit, but individual read order and policy weights can differ. The diagram’s hypothesis is a human interpretation of the extracted evidence; the trained model does not diagnose root causes.', '']
    for index,(start,end,scene) in enumerate(timings):
        caption=scene['narration']
        # Each complete sentence is one timed cue; timing is proportional to word count.
        sentences=re.split(r'(?<=[.!?])\s+',caption)
        words=sum(len(sentence.split()) for sentence in sentences)
        cursor=start+0.2
        available=end-start-0.6
        for sentence in sentences:
            cue_end=cursor+available*len(sentence.split())/words
            vtt.extend([f'{timestamp(cursor)} --> {timestamp(cue_end)}',sentence,''])
            srt.extend([str(sum(1 for item in srt if '-->' in item)+1),f'{timestamp(cursor,",")} --> {timestamp(cue_end,",")}',sentence,''])
            cursor=cue_end
        transcript.extend([f'## {timestamp(start)[:8]} · {scene["label"]}', '', caption, ''])
    (args.output/'train-a-failure-scout.vtt').write_text('\n'.join(vtt))
    (args.output/'train-a-failure-scout.srt').write_text('\n'.join(srt))
    (args.output/'train-a-failure-scout-transcript.md').write_text('\n'.join(transcript))
    manifest={'durationSeconds':round(elapsed,3),'width':WIDTH,'height':HEIGHT,'fps':24,'voice':args.voice,
              'narration':'synthetic','datasetDigest':results['datasetDigest'],
              'scenes':[{'start':round(start,3),'end':round(end,3),'label':scene['label'],'capture':scene.get('screenshot')} for start,end,scene in timings]}
    (args.output/'video-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'video':str(output),'durationSeconds':round(elapsed,3),'bytes':output.stat().st_size},indent=2))


if __name__=='__main__':
    main()
