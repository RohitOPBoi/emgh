import torch
import torch.nn as nn

class CBAM(nn.Module):
    """Convolutional Block Attention Module (Spatial + Channel Attention)
    Crucial for focusing on localized extreme convection in radar frames.
    """
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        
        self.fc = nn.Sequential(
            nn.Conv2d(channels, channels // reduction, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels // reduction, channels, 1, bias=False)
        )
        self.sigmoid_channel = nn.Sigmoid()
        
        self.conv_spatial = nn.Conv2d(2, 1, kernel_size=7, padding=3, bias=False)
        self.sigmoid_spatial = nn.Sigmoid()

    def forward(self, x):
        # Channel Attention
        avg_out = self.fc(self.avg_pool(x))
        max_out = self.fc(self.max_pool(x))
        channel_att = self.sigmoid_channel(avg_out + max_out)
        x = x * channel_att
        
        # Spatial Attention
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        spatial_att = self.sigmoid_spatial(self.conv_spatial(torch.cat([avg_out, max_out], dim=1)))
        
        return x * spatial_att

class DoubleConvDS(nn.Module):
    """Depthwise Separable Double Convolution (SmaAt-UNet efficiency)"""
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1, groups=in_channels, bias=False),
            nn.Conv2d(in_channels, out_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, groups=out_channels, bias=False),
            nn.Conv2d(out_channels, out_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.double_conv(x)

class SmaAt_UNet(nn.Module):
    """
    SmaAt-UNet Architecture for Precipitation Nowcasting.
    Takes recent radar frames (e.g. 4 frames = 1 hour) and predicts the next frame.
    """
    def __init__(self, in_channels=4, out_channels=1):
        super().__init__()
        self.inc = DoubleConvDS(in_channels, 64)
        
        self.down1 = nn.Sequential(nn.MaxPool2d(2), DoubleConvDS(64, 128))
        self.cbam1 = CBAM(128)
        
        self.down2 = nn.Sequential(nn.MaxPool2d(2), DoubleConvDS(128, 256))
        self.cbam2 = CBAM(256)
        
        self.down3 = nn.Sequential(nn.MaxPool2d(2), DoubleConvDS(256, 512))
        self.cbam3 = CBAM(512)
        
        self.up1 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.conv_up1 = DoubleConvDS(512, 256)
        
        self.up2 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.conv_up2 = DoubleConvDS(256, 128)
        
        self.up3 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.conv_up3 = DoubleConvDS(128, 64)
        
        self.outc = nn.Conv2d(64, out_channels, kernel_size=1)

    def forward(self, x):
        x1 = self.inc(x)
        
        x2 = self.down1(x1)
        x2 = self.cbam1(x2)
        
        x3 = self.down2(x2)
        x3 = self.cbam2(x3)
        
        x4 = self.down3(x3)
        x4 = self.cbam3(x4)
        
        x = self.up1(x4)
        x = self.conv_up1(torch.cat([x, x3], dim=1))
        
        x = self.up2(x)
        x = self.conv_up2(torch.cat([x, x2], dim=1))
        
        x = self.up3(x)
        x = self.conv_up3(torch.cat([x, x1], dim=1))
        
        return self.outc(x)

def run_inference_mock(input_frames):
    """
    Since training SEVIR takes 100GB+ and hours of GPU time, 
    this provides the inference interface for the API to call 
    when the model weights are still 'training'.
    """
    model = SmaAt_UNet(in_channels=input_frames.shape[0])
    model.eval()
    with torch.no_grad():
        # Add batch dimension
        x = torch.tensor(input_frames, dtype=torch.float32).unsqueeze(0)
        out = model(x)
        # Remove batch and channel dim
        return out.squeeze().numpy()
