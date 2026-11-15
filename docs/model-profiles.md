# Video prompt profiles

Checked 2026-11-16. Moovicut does not call these services. A fact the provider page does not state stays unverified and uses the generic profile: scene length inside 2–15 seconds, and the studio aspect the person already chose (9:16, 1:1, 4:5, or 16:9). The profiles live in `app/utils/model-profiles.js`. Sora stays its own profile.

## ChatGPT video (`chatgpt`)

OpenAI does not document a ChatGPT video-clip generator.

- [Images in ChatGPT](https://help.openai.com/en/articles/11084440-images-in-chatgpt) documents still images and looping GIFs. It does not state a clip length, an aspect ratio, a prompt length, a seed, or a negative prompt.
- [ChatGPT capabilities overview](https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview) does not list video generation.
- [Create video](https://developers.openai.com/api/reference/resources/videos/methods/create) is the Sora Videos API. Sora 2 and that API were shut down on 2026-09-24. Those limits stay on the `sora` profile.

Duration, aspect, prompt length, seed, negative prompt, and weak spots are unverified. The prompt form is the generic prose prompt.

## Midjourney video (`midjourney`)

- [Video](https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video) says a generation starts at 5 seconds. Extend adds 4 seconds, up to four times, for a maximum of 21 seconds. A scene offers 5 seconds, because an extension is a separate action. The text prompt is optional. Parameters on that page are `--motion low` (the default), `--motion high`, `--raw`, `--loop`, `--end`, and `--bs`. High motion can look unrealistic or glitchy. The dimension table lists starting-image ratios 1:1, 4:3, 2:3, 16:9, and 1:2, and says the video may adjust them. Seed and a negative prompt are not in that list. A prompt length is not stated.
- [Aspect Ratio](https://docs.midjourney.com/hc/en-us/articles/31894244298125-Aspect-Ratio) lists image ratios, including 9:16. That page is not the video dimension table, so 9:16 is not a verified video ratio.

## MiniMax Hailuo (`hailuo`)

- [Create Text-to-Video Generation Task](https://platform.minimax.io/docs/api-reference/video-generation-t2v) lists `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, and `T2V-01`. The prompt is text, up to 2,000 characters. `prompt_optimizer` defaults to true. Duration defaults to 6. MiniMax-Hailuo-2.3 and MiniMax-Hailuo-02 accept 6 or 10 seconds at 768P, and 6 seconds at 1080P. The page documents resolution (720P, 768P, 1080P) and does not document an aspect ratio, a seed, or a negative prompt. Aspect stays the generic default.

## ByteDance Seedance (`seedance`)

- [Create a video generation task](https://docs.byteplus.com/docs/en/modelark/create-video-generation-task-api.md) documents ratios 21:9, 16:9, 4:3, 1:1, 3:4, 9:16, and adaptive. Seed is a request parameter. The page does not say the same seed repeats the same video. It recommends no more than 500 Chinese characters or 1,000 English words and does not state a hard maximum. A negative prompt is not listed. Seedance 2.0 and 2.5 default to adaptive. The studio has no adaptive control. 16:9 is a documented choice, not the documented default. The page does not name a numeric default duration.
- [Seedance 2.0](https://docs.byteplus.com/docs/en/modelark/seedance-2-0.md) says output duration is 4–15 seconds. The profile default is that minimum, 4. An example on the page uses 5 and does not call 5 the default.
- [Seedance 2.5](https://docs.byteplus.com/docs/en/modelark/seedance-2-5.md) says Seedance 2.5 and 2.5 flash output 4–30 seconds, and the 2.0 family outputs 4–15. Lengths 16–30 are documented and not offered. The model id on the profile is `dreamina-seedance-2-0-260128`, from the capabilities table. `duration` `-1` lets the model pick a length and is not offered.

## Pika (`pika`)

- [Pika 2.5 text-to-video](https://dev.pika.art/llms/pika/pika-2.5/text-to-video) says `duration_s` accepts 5 or 10 and defaults to 5. `aspect_ratio` accepts 5:2, 16:9, 4:3, 1:1, 4:5, and 9:16. The page does not name a default ratio. Omitting the field lets the model choose. When a board must pick one, Moovicut uses 16:9, a documented option and not a documented default. `seed` is an integer for reproducible generation, and the page does not state the allowed range. `negative_prompt` is an optional string. The page does not give a prompt length or a list of weak spots. The published example is prose.
