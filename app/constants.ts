export interface PresetItem {
  id: string;
  name: string;
  desc: string;
  width: number;
  height: number;
  isCircle?: boolean;
}

export interface PresetGroup {
  category: string;
  label: string;
  items: PresetItem[];
}

export interface PositionOption {
  label: string;
  value: string;
}

export const PRESET_GROUPS: PresetGroup[] = [
  {
    category: 'friDay_Video',
    label: 'friDay 影音',
    items: [
      { id: 'friday_banner_app', name: '大網 Banner (App)', desc: '1242x828', width: 1242, height: 828 },
      { id: 'friday_banner_web', name: '大網 Banner (Web)', desc: '1920x720 (無Logo)', width: 1920, height: 720 },
      { id: 'friday_poster_port', name: '直式海報', desc: '405x600', width: 405, height: 600 },
      { id: 'friday_poster_land', name: '橫式海報', desc: '1920x1280', width: 1920, height: 1280 },
      { id: 'friday_banner_std', name: '橫式 Banner', desc: '1920x1080', width: 1920, height: 1080 },
      { id: 'friday_fb_post', name: 'FB 貼文', desc: '1080x1080', width: 1080, height: 1080 },
    ]
  },
  {
    category: 'MyVideo',
    label: 'MyVideo',
    items: [
      { id: 'myvideo_cover', name: 'MyVideo 封面圖', desc: '640x910', width: 640, height: 910 },
      { id: 'myvideo_landscape', name: 'MyVideo 橫式圖檔', desc: '2016x1134 (16:9)', width: 2016, height: 1134 },
    ]
  },
  {
    category: 'Hami_Video',
    label: 'Hami Video',
    items: [
      { id: 'hami_banner_thin', name: 'Hami 橫幅 (細)', desc: '1200x400', width: 1200, height: 400 },
      { id: 'hami_banner_large', name: 'Hami 大橫幅', desc: '1200x676', width: 1200, height: 676 },
    ]
  },
  {
    category: 'MOD',
    label: 'MOD',
    items: [
      { id: 'mod_poster', name: '海報封面', desc: '440x620', width: 440, height: 620 },
      { id: 'mod_home_c', name: 'HomeC-VSM (無框)', desc: '926x520', width: 926, height: 520 },
      { id: 'mod_banner_hd', name: 'G-Banner HD', desc: '1280x392', width: 1280, height: 392 },
      { id: 'mod_banner_sd', name: 'G-Banner SD', desc: '720x221', width: 720, height: 221 },
      { id: 'mod_new_logo', name: '新平台橫圖', desc: '500x165', width: 500, height: 165 },
      { id: 'mod_circle', name: '圓形 Icon', desc: '500x500 (無Logo)', width: 500, height: 500, isCircle: true },
    ]
  }
];

export const FLAT_PRESETS: PresetItem[] = PRESET_GROUPS.flatMap(g => g.items);

export const POSITIONS: PositionOption[] = [
  { label: '左上', value: 'top-left' }, { label: '中上', value: 'top-center' }, { label: '右上', value: 'top-right' },
  { label: '左中', value: 'center-left' }, { label: '正中', value: 'center' }, { label: '右中', value: 'center-right' },
  { label: '左下', value: 'bottom-left' }, { label: '中下', value: 'bottom-center' }, { label: '右下', value: 'bottom-right' },
];

export const WATERMARK_POSITIONS: PositionOption[] = [
  { label: '↗ 右上角', value: 'top-right' }, { label: '↘ 右下角', value: 'bottom-right' },
  { label: '↙ 左下角', value: 'bottom-left' }, { label: '↖ 左上角', value: 'top-left' },
];

export const MOD_LABEL_URL = 'https://tang-portico.github.io/img/rightbottomlabel.png';
