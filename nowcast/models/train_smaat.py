"""
Training Loop for SmaAt-UNet on SEVIR Dataset.

This script demonstrates the training pipeline for the SmaAt-UNet model
using the SEVIR (Storm Event Imagery) dataset, which provides radar 
reflectivity sequences suitable for precipitation nowcasting.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np

from nowcast.models.smaat_unet import SmaAt_UNet

class MockSEVIRDataset(Dataset):
    """
    Placeholder for the actual SEVIR HDF5 dataset loader.
    The real dataset is >100GB. This mock generates synthetic shapes 
    to verify the model architecture compiles and trains correctly.
    """
    def __init__(self, num_samples=100, seq_len=4, grid_size=256):
        self.num_samples = num_samples
        self.seq_len = seq_len
        self.grid_size = grid_size

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        # Input: previous 'seq_len' frames (e.g., 4 frames = 1 hour of radar)
        X = torch.randn(self.seq_len, self.grid_size, self.grid_size, dtype=torch.float32)
        # Target: next 1 frame
        Y = torch.randn(1, self.grid_size, self.grid_size, dtype=torch.float32)
        return X, Y


def train_smaat_unet(epochs=5, batch_size=4, lr=1e-4):
    print("Initializing SmaAt-UNet Training Pipeline...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = SmaAt_UNet(in_channels=4, out_channels=1).to(device)
    
    # Using MSE for quantitative rainfall prediction, but typically 
    # combined with structural similarity (SSIM) loss for nowcasting.
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    # Load SEVIR data
    print("Loading SEVIR Dataset (Mock)...")
    dataset = MockSEVIRDataset(num_samples=20)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    print("Starting training loop...")
    model.train()
    for epoch in range(epochs):
        epoch_loss = 0.0
        for batch_idx, (X, Y) in enumerate(dataloader):
            X, Y = X.to(device), Y.to(device)
            
            optimizer.zero_grad()
            predictions = model(X)
            
            loss = criterion(predictions, Y)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {epoch_loss/len(dataloader):.4f}")
        
    print("Training complete. (Note: Full SEVIR training requires 100+ epochs on A100 GPUs)")
    
    # Save checkpoint
    torch.save(model.state_dict(), "smaat_unet_checkpoint.pth")
    print("Model checkpoint saved to smaat_unet_checkpoint.pth")

if __name__ == "__main__":
    train_smaat_unet()
