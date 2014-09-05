vns
====
The project aims to implement the location services for video segments in a decentralized architecture for online streaming services.  
 
Implementation
-----
Currently we've implemented the location server in node.js, and used redis as backend. The server is able to perform operations of video segmentation.  
 
Video Segmentation
-----
In the transmission of video data, the requested range for each segment from one client's playback may not be the same as others'. It depends on the network bandwidth, device capabilities at that times.

For example,
 
 * a client informs the server that it owns the range 1-100 of the video.
 * some times later it again informs the server that it owns the range 101-200 of the video.
 * it is the fact that the client owns 1-200 of the video.
 * the location server should able to deal with the segmentation either in merging or slicing in order to reduce the total recording entries in database.
