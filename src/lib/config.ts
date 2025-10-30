const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL!,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  },
  cloudinary: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME!,
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET!,
  },
};

// Basic validation
for (const key in config) {
  const section = config[key as keyof typeof config];
  for (const subKey in section) {
    if (!section[subKey as keyof typeof section]) {
      throw new Error(`Missing environment variable for ${key}.${subKey}`);
    }
  }
}

export default config;
