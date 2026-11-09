#!/bin/bash
# nhadat-ml/retrain.sh
# Auto-retrain Machine Learning Models for NhaDat.City

# Get the directory of this script dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
fi

echo "========================================"
echo "Bắt đầu cập nhật mô hình AI: $(date)"

echo "1. Cập nhật KNN Recommender..."
timeout 300s python train_recommender.py || echo "[WARN] KNN Recommender training timeout/failed"

echo "2. Cập nhật Anomaly Detection..."
timeout 300s python train_anomaly.py || echo "[WARN] Anomaly Detection training timeout/failed"

echo "3. Restart dịch vụ AI (Zero-Downtime)..."
pm2 reload nhadat-ml || pm2 start /home/hoan/nhadat-next/ecosystem.config.js --only nhadat-ml || true

echo "Hoàn tất cập nhật: $(date)"
echo "========================================"
