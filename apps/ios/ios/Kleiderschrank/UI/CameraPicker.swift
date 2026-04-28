import SwiftUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var imageData: Data?
    @Binding var isPresented: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(imageData: $imageData, isPresented: $isPresented)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        @Binding var imageData: Data?
        @Binding var isPresented: Bool

        init(imageData: Binding<Data?>, isPresented: Binding<Bool>) {
            _imageData = imageData
            _isPresented = isPresented
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            isPresented = false
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = (info[.editedImage] ?? info[.originalImage]) as? UIImage
            imageData = image?.jpegData(compressionQuality: 0.9)
            isPresented = false
        }
    }
}
