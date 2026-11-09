# 1. Base stage - cài đặt môi trường chạy
FROM node:20-alpine AS base

# Cài đặt libc6-compat cho khả năng tương thích của các thư viện trên Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Dependencies stage - cài đặt node_modules sạch cho build
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 3. Builder stage - biên dịch ứng dụng Next.js sang bản phân phối standalone
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tắt tính năng gửi telemetry của Next.js khi build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 4. Runner stage - ảnh chạy production tinh giản tối đa
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Sử dụng user không có quyền root (non-root) để chạy ứng dụng vì lý do bảo mật
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Chỉ sao chép các tệp tĩnh public và kết quả build đã tối giản
COPY --from=builder /app/public ./public

# Cấu hình thư mục cache prerender của Next.js
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Tận dụng output file tracing của Next.js (chỉ copy file chạy standalone cần thiết)
# Giúp giảm kích thước image từ ~1.5GB xuống còn ~150MB
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
